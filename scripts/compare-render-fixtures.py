"""Compare preserved PNG references without overwriting them (requires Pillow).

The software-GPU migration tolerance allows <=4/255 channel error on <=0.05%
of pixels. This covers tiny differences at overlapping translucent edges. It
never relaxes exact repeated-timestamp or independent-renderer equality checks.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops

parser=argparse.ArgumentParser()
parser.add_argument('reference',type=Path)
parser.add_argument('candidate',type=Path)
args=parser.parse_args()
keys=json.loads((args.reference/'hashes.json').read_text())
current=json.loads((args.candidate/'hashes.json').read_text())
if keys.keys()!=current.keys():
    raise SystemExit('Fixture coverage differs')
report=[]
for key in keys:
    if keys[key]==current[key]:
        continue
    with Image.open(args.reference/(key+'.png')) as a,Image.open(args.candidate/(key+'.png')) as b:
        if a.size!=b.size:
            raise SystemExit('Dimensions changed: '+key)
        difference=ImageChops.difference(a.convert('RGB'),b.convert('RGB'))
        pixels=list(difference.get_flattened_data())
        changed=sum(any(rgb) for rgb in pixels)
        maximum=max(v[1] for v in difference.getextrema())
        report.append(dict(fixture=key,changed_pixels=changed,max_channel_error=maximum))
        if maximum>4 or changed>len(pixels)*.0005:
            raise SystemExit(f'Visual regression: {key}, {changed} changed pixels, max error {maximum}')
print(json.dumps(dict(fixtures=len(keys),exact=len(keys)-len(report),tolerated=report),indent=2))
