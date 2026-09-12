"""Promote the verified, immutable Option 13 into site playback assets."""
from pathlib import Path
import hashlib
import json
import re
import xml.etree.ElementTree as ET

app = Path(__file__).resolve().parents[2]
source = app / 'public/brand/motion/options/option-13'
target = app / 'public/brand/main'
manifest = json.loads((source / 'manifest.json').read_text())
assert manifest['option'] == 13 and manifest['status'] == 'locked'
for name, digest in manifest['files'].items():
    saved_bytes = (source / name).read_bytes()
    assert digest in [hashlib.sha256(saved_bytes).hexdigest(),
                      hashlib.sha256(saved_bytes.replace(b'\r\n', b'\n')).hexdigest()], name
target.mkdir(exist_ok=True)
ET.register_namespace('', 'http://www.w3.org/2000/svg')
tag = lambda name: '{http://www.w3.org/2000/svg}' + name
files = {}
for kind in ['logo', 'symbol']:
    for mode in ['light', 'dark']:
        original = (source / f'introify-{kind}-{mode}.svg').read_text()
        # Share the approved light-mode lettering blue across both site themes.
        # Saved studio options stay immutable; this is a site palette override.
        if kind == 'logo' and mode == 'dark':
            original = original.replace('#00ccec', '#0073d5')
        for playback in ['once', 'still']:
            root = ET.fromstring(original)
            # Preserve the saved viewport padding so the rotated dot stays visible.
            # Tight cropping to the lettering bounds clips the icon during playback.
            for parent in root.iter():
                for child in list(parent):
                    if child.tag == tag('style') or child.get('class') == 'still':
                        parent.remove(child)
                    elif child.tag in [tag('animate'), tag('animateTransform')]:
                        if playback == 'once':
                            child.set('repeatCount', '1')
                            child.set('fill', 'freeze')
                        else:
                            # The selected clip ends on the completed logo.
                            value = child.get('values').split(';')[-1]
                            if child.tag == tag('animateTransform'):
                                value = f"{child.get('type')}({value})"
                            parent.set(child.get('attributeName'), value)
                            parent.remove(child)
            name = f'introify-{kind}-{mode}-{playback}.svg'
            content = ET.tostring(root, encoding='unicode')
            (target / name).write_text(content, encoding='utf-8')
            files[name] = hashlib.sha256(content.encode()).hexdigest()
selection = {'option': 13, 'status': 'locked', 'sourceHash': manifest['sourceHash'],
             'duration': manifest['duration'], 'restFrame': 120,
             'letteringAccent': '#0073d5', 'files': files}
(target / 'manifest.json').write_text(json.dumps(selection, indent=2)+'\n')
(app / 'src/components/brand/selected-option.json').write_text(json.dumps({
    'option': 13, 'duration': manifest['duration'], 'sourceHash': manifest['sourceHash']
}, indent=2)+'\n')
print('Verified and promoted Option 13; original saved files unchanged.')

# The transition retains the separately approved gentle Option 10.
loading_source = app / 'public/brand/motion/options/option-10'
loading = json.loads((loading_source / 'manifest.json').read_text())
assert loading['option'] == 10 and loading['status'] == 'locked'
for name, digest in loading['files'].items():
    saved_bytes = (loading_source / name).read_bytes()
    assert digest in [hashlib.sha256(saved_bytes).hexdigest(),
                      hashlib.sha256(saved_bytes.replace(b'\r\n', b'\n')).hexdigest()], name
for mode in ['light', 'dark']:
    original = (loading_source / f'introify-symbol-{mode}.svg').read_text()
    (target / f'loading-{mode}.svg').write_text(original, encoding='utf-8')
    root = ET.fromstring(original)
    for parent in root.iter():
        for child in list(parent):
            if child.tag == tag('style') or child.get('class') == 'still':
                parent.remove(child)
            elif child.tag in [tag('animate'), tag('animateTransform')]:
                value = child.get('values').split(';')[45]
                if child.tag == tag('animateTransform'):
                    value = f"{child.get('type')}({value})"
                parent.set(child.get('attributeName'), value)
                parent.remove(child)
    (target / f'loading-{mode}-still.svg').write_text(ET.tostring(root, encoding='unicode'), encoding='utf-8')
(target / 'loading-manifest.json').write_text(json.dumps({
    'option': 10, 'status': 'locked', 'sourceHash': loading['sourceHash'],
    'duration': loading['duration']
}, indent=2)+'\n')
print('Verified and promoted Option 10 for page loading.')
