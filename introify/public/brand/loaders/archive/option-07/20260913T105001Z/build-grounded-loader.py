"""Compose the immutable Studio 04 take and a synchronized contact-plane ring."""
from pathlib import Path
import copy
import hashlib
import json
import math
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'public/brand'
DEST = ROOT / 'loading-options/grounded'
DEST.mkdir(exist_ok=True)
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
def tag(name): return f'{{{NS}}}{name}'
def element(name, **attrs): return ET.Element(tag(name), {k:str(v) for k,v in attrs.items()})

for mode in ('light', 'dark'):
    source = ROOT / f'motion/options/option-4/introify-symbol-{mode}.svg'
    svg = ET.parse(source).getroot()
    motion = svg.find(f'{tag("g")}[@class="motion"]')
    dot = motion.find(f'.//{tag("ellipse")}')
    values = {a.get('attributeName'):list(map(float,a.get('values').split(';'))) for a in dot}
    contact = max(range(len(values['cy'])), key=lambda i: values['cy'][i]+values['ry'][i])
    phase = contact/(len(values['cy'])-1)
    icon_scale, pivot_x, pivot_y = 2, 88, 90
    icon = element('g', id='scaled-icon', transform=f'translate({pivot_x} {pivot_y}) scale({icon_scale}) translate({-pivot_x} {-pivot_y})')
    for child in list(motion):
        motion.remove(child); icon.append(child)
    motion.append(icon)
    cx = pivot_x + icon_scale*(values['cx'][contact]-pivot_x)
    floor = pivot_y + icon_scale*(values['cy'][contact]+values['ry'][contact]-pivot_y)
    rx, ry, cy = 58, 18, floor+18
    # Begin at the phase that puts the advancing ring tip at the contact point
    # when the dot reaches its lowest boundary. Preserve the original take.
    angle = -math.pi/2-2*math.pi*phase
    x, y = cx+rx*math.cos(angle), cy+ry*math.sin(angle)
    opposite_x, opposite_y = 2*cx-x, 2*cy-y
    d = f'M{x:.6f} {y:.6f} A{rx} {ry} 0 1 1 {opposite_x:.6f} {opposite_y:.6f} A{rx} {ry} 0 1 1 {x:.6f} {y:.6f}'
    ring = element('g', id='contact-ring', fill='none', stroke='#0079d4' if mode=='light' else '#41baff')
    track = element('path', d=d, opacity='.18', **{'stroke-width':'1.8'})
    ring.append(track)
    # An angularly sampled dash offset accounts for elliptical arc length, so
    # the highlighted edge arrives exactly at contact, rather than 46% by guess.
    samples = 2400
    lengths = [0.0]
    previous = (x,y)
    for i in range(1,samples+1):
        a=angle+2*math.pi*i/samples
        current=(cx+rx*math.cos(a),cy+ry*math.sin(a))
        lengths.append(lengths[-1]+math.dist(previous,current)); previous=current
    offsets = [100*(1-lengths[i*20]/lengths[-1]) for i in range(121)]
    sweep = element('path', id='contact-progress', d=d, pathLength='100', **{'stroke-width':'2.5','stroke-linecap':'round','stroke-dasharray':'100','stroke-dashoffset':'100'})
    sweep.append(element('animate', attributeName='stroke-dashoffset', values=';'.join(f'{v:.6f}' for v in offsets), keyTimes=';'.join(f'{i/120:.8f}' for i in range(121)), dur='2.8s', repeatCount='indefinite', calcMode='linear'))
    sweep.append(element('animate', attributeName='opacity', values='1;1;0', keyTimes='0;0.97;1', dur='2.8s', repeatCount='indefinite'))
    ring.append(sweep)
    motion.insert(0,ring)
    # The reduced-motion state is the same composition, frozen at contact.
    still=copy.deepcopy(motion); still.set('class','still')
    for parent in still.iter():
        for child in list(parent):
            if child.tag==tag('animate'):
                vals=child.get('values','').split(';')
                if len(vals)==121: value=vals[contact]
                else: value=vals[0]
                parent.set(child.get('attributeName'),value); parent.remove(child)
    old_still=svg.find(f'{tag("g")}[@class="still"]'); svg.remove(old_still); svg.append(still)
    svg.set('aria-label','Introify grounded orbit loading animation')
    svg.set('data-loop-seconds','2.8'); svg.set('data-contact-x',str(cx)); svg.set('data-contact-y',str(floor)); svg.set('data-contact-seconds',str(phase*2.8))
    ET.ElementTree(svg).write(DEST/f'loader-{mode}.svg',encoding='utf-8',xml_declaration=True)
    static=copy.deepcopy(svg); static.remove(static.find(f'{tag("g")}[@class="motion"]'))
    static.remove(static.find(tag('style'))); static.find(f'{tag("g")}[@class="still"]').attrib.pop('class')
    ET.ElementTree(static).write(DEST/f'loader-{mode}-still.svg',encoding='utf-8',xml_declaration=True)
    metadata={'sourceOption':4,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'duration':2.8,'iconScale':icon_scale,'iconPivot':{'x':pivot_x,'y':pivot_y},'contact':{'frame':contact,'seconds':phase*2.8,'x':cx,'y':floor},'ring':{'cx':cx,'cy':cy,'rx':rx,'ry':ry},'clock':'single-svg-smil'}
    (DEST/f'geometry-{mode}.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(mode,json.dumps(metadata))
