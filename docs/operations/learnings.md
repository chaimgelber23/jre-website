## /donate deploy smoketest — 2026-04-24T00:00:00Z

- Commit on main: 13f72a4b502a2713ae026a02f026616321e2c4ef
- /donate HTTP: 200
- HTML contains 'OJC Fund': PASS
- HTML contains 'Donors Fund': PASS
- HTML contains 'Credit Card': PASS
- HTML has lucide-heart in Donate button: PASS (absent)
- POST card invalid: 400 {"success":false,"error":"Declined by Processor or Issuer - Service not allowed or invalid surcharge amount"}
- POST donors_fund missing fields: 400 {"success":false,"error":"Please enter your Giving Card + CVV (or email + PIN)."}
- POST ojc_fund missing fields: 400 {"success":false,"error":"Please enter your OJC Charity Card number and expiration."}

**Overall:** PASS
All HTML content checks and API route validations returned expected results; no 5xx errors observed. Deploy health check script skipped (requires GH_TOKEN not available in this environment).
