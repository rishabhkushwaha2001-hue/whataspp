import re
from datetime import datetime

def parse_timing(timing_str):
    try:
        parts = re.split(r'-|TO', timing_str.upper())
        if len(parts) == 2:
            def parse_time_part(t_str):
                # Normalize spacing: e.g. "7AM" -> "7 AM", "07:00PM" -> "07:00 PM"
                t_str = re.sub(r'(AM|PM)', r' \1', t_str.strip().replace(" ", ""))
                t_str = t_str.replace("  ", " ").strip()
                print("Parsing part:", t_str)
                try:
                    return datetime.strptime(t_str, "%I:%M %p")
                except ValueError:
                    try:
                        return datetime.strptime(t_str, "%I %p")
                    except ValueError:
                        return datetime.strptime(t_str, "%H:%M")
                        
            start_dt = parse_time_part(parts[0])
            end_dt   = parse_time_part(parts[1])
            return start_dt.hour * 60 + start_dt.minute, end_dt.hour * 60 + end_dt.minute
    except Exception as e:
        print("Error:", e)
    return -1, -1

print("Test 1:", parse_timing("10:30 AM to 06:30 PM"))
print("Test 2:", parse_timing("1030 AM to 0630 PM"))
print("Test 3:", parse_timing("10:30 AM - 06:30 PM"))
