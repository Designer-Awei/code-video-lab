"""Build silent README GIFs and a social-ready MP4 from the local finished movie.
All times below are body timeline seconds; --offset accounts for the cover intro.
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[1]
CLIPS=[
    {'id':'car-reveal','title':'Engraved Motorwagen reveal','start':50.1,'duration':6.7},
    {'id':'filmstrip','title':'Mechanical evolution on a moving filmstrip','start':371.8,'duration':6.6},
    {'id':'history-carousel','title':'Seven-stage mechanical history carousel','start':393.1,'duration':8.0},
    {'id':'typewriter','title':'Type, backspace, and retype','start':401.7,'duration':3.3},
]

def run(args):
    subprocess.run(['ffmpeg','-y','-v','error',*args],check=True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--video',type=Path,default=ROOT/'out/final_leibus.mp4')
    ap.add_argument('--offset',type=float,default=2.0)
    a=ap.parse_args()
    gallery=REPO/'docs/gallery';gallery.mkdir(parents=True,exist_ok=True)
    temp=ROOT/'qa/showcase';temp.mkdir(parents=True,exist_ok=True)
    segments=[]
    for c in CLIPS:
        seek=str(c['start']+a.offset);duration=str(c['duration'])
        filt='hqdn3d=1.5:1.5:6:6,fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle'
        run(['-ss',seek,'-t',duration,'-i',str(a.video),'-an','-filter_complex',filt,'-loop','0',str(gallery/(c['id']+'.gif'))])
        segment=temp/(c['id']+'.mp4')
        run(['-ss',seek,'-t',duration,'-i',str(a.video),'-an','-vf','scale=1280:720:flags=lanczos',
             '-r','30','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p',str(segment)])
        segments.append(segment)
        print(c['id'],(gallery/(c['id']+'.gif')).stat().st_size,flush=True)
    listing=temp/'concat.txt'
    listing.write_text(''.join(f"file '{p.resolve().as_posix()}'\n" for p in segments),encoding='utf-8')
    run(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-an','-movflags','+faststart',str(gallery/'code-video-showreel.mp4')])
    (gallery/'clips.json').write_text(json.dumps({'cover_offset_seconds':a.offset,'silent':True,'clips':CLIPS},indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
