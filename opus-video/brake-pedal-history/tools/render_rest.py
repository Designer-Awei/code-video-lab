"""Validated chapter cache and rendering, with optional narration assembly."""
import argparse
import json
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RENDER=ROOT.parents[1]/'skills/code-video/scripts/render.py'
TL=json.loads((ROOT/'timeline.json').read_text(encoding='utf-8'))

def valid(path,ch):
    if not path.exists():return False
    try:
        r=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames','-of','json',str(path)]))
        v=next(x for x in r['streams'] if x['codec_type']=='video')
        num,den=map(int,v['r_frame_rate'].split('/'))
        return (v['width']==1920 and v['height']==1080 and abs(num/den-TL['fps'])<.01
            and abs(float(r['format']['duration'])-(ch['end']-ch['start']))<2/TL['fps']
            and abs(int(v['nb_frames'])-round((ch['end']-ch['start'])*TL['fps']))<=1)
    except (subprocess.CalledProcessError,ValueError,KeyError,StopIteration):return False

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--output',default='out/body.mp4')
    ap.add_argument('--chapters',type=int,nargs='+')
    ap.add_argument('--dry-run',action='store_true')
    a=ap.parse_args()
    out=ROOT/'out';out.mkdir(exist_ok=True)
    segments=[]
    for c in TL['chapters']:
        dest=out/f"ch{c['index']:02d}.mp4"
        reuse=valid(dest,c)
        print(f"{'reuse' if reuse else 'render'} {dest.name}",flush=True)
        if not reuse and a.chapters and c['index'] not in a.chapters:
            raise SystemExit(f"Missing/invalid unselected chapter {c['index']}; choose it explicitly")
        if not reuse and not a.dry_run:
            pending=out/f"ch{c['index']:02d}.pending.mp4"
            subprocess.run([sys.executable,str(RENDER),'index.html',str(pending),'--size','1920x1080','--fps',str(TL['fps']),'--start',str(c['start']),'--duration',str(round(c['end']-c['start'],3)),'--crf','23'],cwd=ROOT,check=True)
            if not valid(pending,c):raise RuntimeError(f'Invalid render: {pending}')
            pending.replace(dest)
        segments.append(dest)
    if a.dry_run:return
    listing=out/'concat.txt'
    listing.write_text(''.join(f"file '{p.resolve().as_posix()}'\n" for p in segments),encoding='utf-8')
    final=ROOT/a.output;final.parent.mkdir(parents=True,exist_ok=True)
    pending=final.with_name(final.stem+'.pending.mp4')
    cmd=['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing)]
    mix=ROOT/'audio/mix/mix.wav'
    if mix.exists():cmd+=['-i',str(mix),'-map','0:v:0','-map','1:a:0','-c:a','aac','-b:a','128k','-shortest']
    cmd+=['-c:v','copy',str(pending)]
    subprocess.run(cmd,check=True)
    result=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(pending)]))
    assert abs(float(result['format']['duration'])-TL['duration'])<.1,'Unexpected assembled duration'
    pending.replace(final)
    print(final)
if __name__=='__main__':main()
