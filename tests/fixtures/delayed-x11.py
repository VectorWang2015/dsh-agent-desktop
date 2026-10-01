"""Private smoke fixture: deliberately delay processing X events until a file permits it."""
import json
import sys
import time
from pathlib import Path
from Xlib import X, XK, display

base = Path(sys.argv[1])
d = display.Display()
root = d.screen().root
window = root.create_window(40, 610, 700, 110, 0, d.screen().root_depth, X.InputOutput, X.CopyFromParent, background_pixel=d.screen().white_pixel, event_mask=X.KeyPressMask | X.StructureNotifyMask)
window.set_wm_name('Delayed Unicode test receiver')
window.map()
d.sync()
(base / 'ready.json').write_text(json.dumps({'window': window.id}))
end = time.monotonic() + 20
while not (base / 'accept').exists():
    if time.monotonic() > end:
        raise RuntimeError('Test producer never released delayed receiver')
    time.sleep(0.01)
text = ''
while time.monotonic() < end:
    if not d.pending_events():
        time.sleep(0.01)
        continue
    event = d.next_event()
    if event.type == X.MappingNotify:
        d.refresh_keyboard_mapping(event)
    if event.type != X.KeyPress:
        continue
    sym = d.keycode_to_keysym(event.detail, 1 if event.state & X.ShiftMask else 0)
    if sym == XK.string_to_keysym('Return'):
        (base / 'receipt.json').write_text(json.dumps({'text': text}, ensure_ascii=False))
        break
    if sym & 0xff000000 == 0x01000000:
        text += chr(sym & 0x00ffffff)
    elif 32 <= sym <= 255:
        text += chr(sym)
d.close()
