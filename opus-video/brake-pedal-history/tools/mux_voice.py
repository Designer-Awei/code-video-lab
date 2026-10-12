"""Mux replacement narration while proving the video packets remain unchanged."""
import argparse
import json
import os
import subprocess
from pathlib import Path

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries',
        'format=duration:stream=codec_type,nb_frames','-of','json',str(path)]))

def video_hash(path):
    return subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map','0:v:0',
        '-c','copy','-f','hash','-hash','sha256','-']).decode().strip()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('video',type=Path);ap.add_argument('audio',type=Path);ap.add_argument('output',type=Path)
    ap.add_argument('--offset',type=float,default=0)
    ap.add_argument('--overwrite',action='store_true')
    a=ap.parse_args()
    if a.video.resolve()==a.output.resolve():ap.error('Output must differ from source video')
    if a.output.exists() and not a.overwrite:ap.error('Output exists; use another path or --overwrite')
    if a.offset<0:ap.error('Offset must be non-negative')
    before=probe(a.video);dur=before['format']['duration']
    a.output.parent.mkdir(parents=True,exist_ok=True)
    pending=a.output.with_name(a.output.stem+'.pending.mp4')
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(a.video),'-i',str(a.audio),'-map','0:v:0','-map','1:a:0',
        '-c:v','copy','-af',f'adelay={round(a.offset*1000)},apad','-ar','48000','-c:a','aac','-b:a','128k',
        '-t',dur,'-movflags','+faststart',str(pending)],check=True)
    after=probe(pending)
    assert abs(float(after['format']['duration'])-float(dur))<.05,'Duration changed'
    assert video_hash(a.video)==video_hash(pending),'Video packets changed'
    subprocess.run(['ffmpeg','-v','error','-i',str(pending),'-f','null',os.devnull],check=True)
    pending.replace(a.output)
    print(f'Validated replacement: {a.output}; offset={a.offset}s; original video unchanged')

if __name__=='__main__':main()
