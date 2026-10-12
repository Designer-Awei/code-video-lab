"""Align a replacement voice to the approved audio without speech transcription.

Speaker-normalized cepstral DTW locates candidate pauses. Edits only cut inside
silence in BOTH recordings; each intervening phrase is stretched with FFmpeg
atempo (pitch preserved). Original chapter timing and waveform pauses remain.
Outputs are separate from the approved Awei originals and timeline.
"""
import json
import argparse
import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.fft import dct
from scipy.spatial.distance import cdist
from numba import njit

ROOT = Path(__file__).resolve().parents[1]
REPLACEMENT = ROOT / 'audio/vo/replacement'
SR = 48000
HOP = .02


def read(path, sr=SR):
    """Decode with FFmpeg, including float WAVs from different TTS engines."""
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(sr),'-'])
    return np.frombuffer(raw,dtype=np.float32).copy()


def write(path,a):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR)
        w.writeframes((np.clip(a,-.999,.999)*32767).astype(np.int16).tobytes())


def features(a):
    """MFCCs with cepstral normalization remove most speaker timbre differences."""
    x=signal.resample_poly(a,1,3)
    _,_,z=signal.stft(x,16000,nperseg=400,noverlap=80,nfft=512,boundary='zeros')
    f=np.linspace(0,8000,257)
    mel=lambda hz:2595*np.log10(1+hz/700)
    hz=lambda m:700*(10**(m/2595)-1)
    bins=hz(np.linspace(mel(70),mel(7600),42))
    bank=np.array([np.maximum(0,np.minimum((f-bins[i])/(bins[i+1]-bins[i]),(bins[i+2]-f)/(bins[i+2]-bins[i+1]))) for i in range(40)])
    spec=np.log(np.maximum(bank@(np.abs(z)**2),1e-12))
    coeff=dct(spec,type=2,axis=0,norm='ortho')[1:14].T
    coeff=(coeff-coeff.mean(axis=0))/(coeff.std(axis=0)+1e-6)
    energy=10*np.log10(np.maximum((np.abs(z)**2).sum(axis=0),1e-12))
    voiced=np.clip((energy+58)/24,0,1)
    return np.column_stack([coeff*.35,voiced*3])


@njit
def path_dtw(cost):
    """Monotonic bounded DTW; predecessor steps are stored for backtracking."""
    n,m=cost.shape
    acc=np.full((n+1,m+1),np.inf,dtype=np.float32);acc[0,0]=0
    prev=np.zeros((n,m),dtype=np.uint8)
    for i in range(1,n+1):
        lo=max(1,int(i*m/n-m*.16));hi=min(m,int(i*m/n+m*.16)+2)
        for j in range(lo,hi+1):
            a=acc[i-1,j-1];b=acc[i-1,j]+.3;c=acc[i,j-1]+.3
            if a<=b and a<=c: acc[i,j]=a+cost[i-1,j-1];prev[i-1,j-1]=0
            elif b<=c:acc[i,j]=b+cost[i-1,j-1];prev[i-1,j-1]=1
            else:acc[i,j]=c+cost[i-1,j-1];prev[i-1,j-1]=2
    i,j=n-1,m-1;points=[]
    while i>=0 and j>=0:
        points.append((i,j));p=prev[i,j]
        if p==0:i-=1;j-=1
        elif p==1:i-=1
        else:j-=1
    return points[::-1]


def pauses(a,min_len=.16):
    """Wide low-energy regions only, avoiding short consonant closures."""
    hop=int(SR*.01);n=len(a)//hop
    rms=np.sqrt((a[:n*hop].reshape(n,hop)**2).mean(axis=1)+1e-12)
    # The original pause editor used -40 dBFS; cloned recordings carry room noise.
    # A -52 dB floor would miss genuine pauses in that existing voice track.
    threshold=min(.01,max(.005,np.percentile(rms,75)*.075))
    quiet=rms<threshold
    changes=np.diff(np.r_[False,quiet,False].astype(int))
    return [(s*.01,e*.01) for s,e in zip(np.where(changes==1)[0],np.where(changes==-1)[0]) if (e-s)*.01>=min_len]


def fit(source,length):
    """Pitch-preserving phrase tempo, padded to a sample-exact target length."""
    if not len(source):return np.zeros(length,dtype=np.float32)
    rate=len(source)/length
    filters=[]
    while rate>2:filters.append('atempo=2');rate/=2
    while rate<.5:filters.append('atempo=0.5');rate/=.5
    filters.append(f'atempo={rate:.9f}')
    data=subprocess.check_output(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-',
                                  '-af',','.join(filters),'-f','f32le','-'],input=source.astype(np.float32).tobytes())
    out=np.frombuffer(data,dtype=np.float32).copy()
    # FFmpeg's WSOLA endpoint may differ by a few ms; those endpoints are silence.
    out=np.pad(out,(0,max(0,length-len(out))))[:length]
    fade=min(240,len(out)//2)
    if fade:out[:fade]*=np.linspace(0,1,fade);out[-fade:]*=np.linspace(1,0,fade)
    return out


def align(ch):
    sid=ch['id'];original=read(ROOT/ch['vo_file']);new=read(REPLACEMENT/f'{sid}.wav')
    f1,f2=features(original),features(new)
    cost=cdist(f1,f2,metric='sqeuclidean').astype(np.float32)
    pairs=np.array(path_dtw(cost));mapping=np.interp(np.arange(len(f1)),pairs[:,0],pairs[:,1])*HOP
    old_pauses=pauses(original,.12);new_pauses=pauses(new,.10)
    links=[];last=-1
    for s,e in old_pauses:
        # Keep original intro/outro breathing space separately.
        if s<.04 or e>len(original)/SR-.04:continue
        estimate=float(np.interp((s+e)/2/HOP,np.arange(len(mapping)),mapping))
        options=[(abs((ns+ne)/2-estimate),k,ns,ne) for k,(ns,ne) in enumerate(new_pauses) if k>last and ns>.03 and ne<len(new)/SR-.03]
        if not options:continue
        dist,k,ns,ne=min(options)
        if dist>.4:continue
        if links and (s-links[-1][1]<.55 or ns-links[-1][3]<.45):continue
        # Full quiet spans are preserved instead of spreading their time over speech.
        links.append((s,e,ns,ne));last=k
    newquiet=pauses(new,.08);oldquiet=pauses(original,.08)
    os0=oldquiet[0][1] if oldquiet and oldquiet[0][0]==0 else 0
    ns0=newquiet[0][1] if newquiet and newquiet[0][0]==0 else 0
    oe0=oldquiet[-1][0] if oldquiet and oldquiet[-1][1]>=len(original)/SR-.02 else len(original)/SR
    ne0=newquiet[-1][0] if newquiet and newquiet[-1][1]>=len(new)/SR-.02 else len(new)/SR
    links=[(os0,os0,ns0,ns0)]+links+[(oe0,oe0,ne0,ne0)]
    output=np.zeros(len(original),dtype=np.float32);rates=[]
    for left,right in zip(links,links[1:]):
        a,b=int(left[1]*SR),int(right[0]*SR);na,nb=int(left[3]*SR),int(right[2]*SR)
        if b<=a or nb<=na:continue
        rate=(nb-na)/(b-a);rates.append(rate)
        output[a:b]=fit(new[na:nb],b-a)
    # Keep the replacement voice's quiet breathing/room tone inside each gap.
    # For the long intentionally designed gaps, pad around it instead of
    # stretching a short breath several-fold or borrowing the old speaker.
    for s,e,ns,ne in links[1:-1]:
        start,stop=round(s*SR),round(e*SR)
        quiet=new[round(ns*SR):round(ne*SR)].copy()
        n=min(stop-start,len(quiet))
        if n<=0:continue
        quiet=quiet[(len(quiet)-n)//2:(len(quiet)-n)//2+n]
        fade=min(240,n//2)
        if fade:quiet[:fade]*=np.linspace(0,1,fade);quiet[-fade:]*=np.linspace(1,0,fade)
        offset=start+(stop-start-n)//2
        output[offset:offset+n]=quiet
    dest=REPLACEMENT/'aligned'/f'{sid}.wav';dest.parent.mkdir(exist_ok=True);write(dest,output)
    report={'id':sid,'original_seconds':len(original)/SR,'generated_seconds':len(new)/SR,
            'matched_pause_count':len(links)-2,'tempo_min':min(rates),'tempo_max':max(rates),
            'tempo_rates':rates,'pause_matches':links,'file':str(dest.relative_to(ROOT))}
    print(json.dumps({k:v for k,v in report.items() if k not in ['tempo_rates','pause_matches']},ensure_ascii=True),flush=True)
    return output,report


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',type=int)
    args=parser.parse_args()
    (ROOT/'qa').mkdir(exist_ok=True)
    (ROOT/'audio/mix').mkdir(parents=True,exist_ok=True)
    tl=json.loads((ROOT/'timeline.json').read_text(encoding='utf-8'))
    reports=[];mix=np.zeros(round(tl['duration']*SR),dtype=np.float32)
    for ch in tl['chapters']:
        if args.only and ch['index']!=args.only:continue
        a,r=align(ch);reports.append(r);start=round(ch['vo_start']*SR)
        mix[start:start+len(a)]=a
        (ROOT/'qa/voice_alignment.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
    if args.only:return
    raw=ROOT/'audio/mix/mix_replacement_raw.wav';write(raw,mix)
    out=ROOT/'audio/mix/mix_replacement.wav'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-af','loudnorm=I=-14:TP=-1:LRA=11','-ar',str(SR),str(out)],check=True)
    print(str(out),flush=True)


if __name__=='__main__':main()
