import re
from datetime import datetime

def parse_timing(timing_str):
    try:
        parts = re.split(r'-|TO', timing_str.upper())
        if len(parts) == 2:
            def parse_time_part(t_str):
                # Add a space before AM/PM if missing
                t_str = re.sub(r'(AM|PM)', r' \1', t_str.strip().replace(" ", ""))
                t_str = t_str.replace("  ", " ").strip()
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
        print(f"Exception: {e}")
        pass
    return -1, -1

# Simulate the problem
timings = ["7 AM to 3 PM", "7am to 3pm", "07:00AM TO 03:00PM", "7:00AM-3:00PM"]
current_time_minutes = 9 * 60 + 42 # 9:42 AM

for timing in timings:
    start_min, end_min = parse_timing(timing)
    shift_active = False
    if start_min != -1 and end_min != -1:
        if end_min < start_min:   # overnight shift
            shift_active = current_time_minutes >= start_min or current_time_minutes < end_min
        else:
            shift_active = start_min <= current_time_minutes <= end_min
    
    print(f"Timing: '{timing}' -> start: {start_min}, end: {end_min}, active at 9:42 AM: {shift_active}")
