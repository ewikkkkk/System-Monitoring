# Daily METS report to Teams

This folder is a standalone Windows workflow. Copy the entire folder to the Windows PC that will run the schedule. It reads the METS Excel export and posts Adaptive Cards using Microsoft Teams Workflows.

1. In Teams, create **Send webhook alerts to a chat** and select the intended destination. Use the **Anyone** webhook template and keep the generated URL private. Use a test chat first.
2. Install Node.js 20.19+ and PowerShell 7. In this folder, run `npm ci`.
3. Run `pwsh -File setup.ps1 -TestSend` and enter the test webhook URL when prompted. Check the chat for the sample card.
4. Run `pwsh -File setup.ps1` and paste the desired destination's webhook URL into the hidden prompt. Windows encrypts the URL for your account on this PC. The script registers the scheduled task **System Monitoring Daily Teams Report**, replacing the previous version if it was registered.
5. Place the complete METS export in `exports` before 9:00 AM Manila time. Use a `Tickets` worksheet and name the workbook `METS-YYYY-MM-DD.xlsx` using its Manila report date. Copy it with a temporary name, then rename it after the copy completes. Repeat for each reporting day.

Keep the PC awake and signed in. The task retries a missing export every five minutes after 9:00 AM, through the end of that Manila date. It reads only the file dated for that day. You can check a workbook locally with `node send.mjs --preview "path-to-export.xlsx"`. This prints counts and the number of Teams cards.

The report groups ticket statuses by assignee and includes clickable ticket links. The delivery log is in `.local/delivery.log`. The workflow reserves the date before sending to prevent duplicate posts, including after a restart. If delivery stops partway through, check the chat and Teams Workflow run history before resetting that date's record.
