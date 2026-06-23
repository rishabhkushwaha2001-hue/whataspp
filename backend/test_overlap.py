import re

def parse_timing(timing_str: str):
    try:
        parts = re.split(r'-|TO', timing_str.upper())
        if len(parts) != 2: return 0, 0
        def to_minutes(t_str):
            t_str = t_str.strip()
            match = re.match(r'(\d+)(?::(\d+))?\s*(AM|PM)?', t_str)
            if not match: return 0
            h = int(match.group(1))
            m = int(match.group(2) or 0)
            ampm = match.group(3)
            if ampm == 'PM' and h != 12: h += 12
            if ampm == 'AM' and h == 12: h = 0
            return h * 60 + m
        return to_minutes(parts[0]), to_minutes(parts[1])
    except: return 0, 0

def check_overlap(t1, t2):
    s1, e1 = parse_timing(t1)
    s2, e2 = parse_timing(t2)
    print(f"t1: {s1} - {e1}")
    print(f"t2: {s2} - {e2}")

    def get_minutes_set(start, end):
        if end < start: return set(range(start, 24*60)) | set(range(0, end))
        else: return set(range(start, end))

    print("Intersect?", bool(get_minutes_set(s1, e1).intersection(get_minutes_set(s2, e2))))

check_overlap("10:00 AM - 03:00 PM", "03:00 PM - 07:00 PM")
check_overlap("10 AM - 3 PM", "3 PM - 7 PM")
