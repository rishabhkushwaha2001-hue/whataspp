import httpx
from typing import Any, Dict, Optional

async def send_push_notification(expo_token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Sends a push notification to a device using its Expo Push Token.
    
    Args:
        expo_token: The Expo push token (e.g., 'ExponentPushToken[xxx]')
        title: Title of the notification
        body: Body content of the notification
        data: Optional key-value custom data payload
        
    Returns:
        The response dictionary from the Expo Push API.
    """
    if not expo_token or not expo_token.startswith("ExponentPushToken"):
        print(f"Skipping notification: Invalid or empty push token: {expo_token}")
        return {"status": "error", "message": "Invalid token format"}
        
    url = "https://exp.host/--/api/v2/push/send"
    headers = {
        "Content-Type": "application/json",
        "accept-encoding": "gzip, deflate",
        "accept": "application/json"
    }
    
    payload = {
        "to": expo_token,
        "title": title,
        "body": body,
        "sound": "default",
    }
    
    if data:
        payload["data"] = data
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            result = response.json()
            print(f"Push notification sent successfully to {expo_token}. Response: {result}")
            return result
    except Exception as e:
        print(f"Failed to send push notification to {expo_token}: {e}")
        return {"status": "error", "message": str(e)}
