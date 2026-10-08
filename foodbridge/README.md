# FoodBridge – SDG 2 & SDG 12 Web Application

## Run
```bash
cd foodbridge
node server.js   # or: npm start  -> http://localhost:3000  (no npm install needed)
```
Optional: `SECRET=yourlongsecret PORT=3000 npm start`

## Structure
- `server.js` – Node.js REST API (built-in http module, zero dependencies), auth (scrypt + HMAC token), JSON-file persistence (`data.json`, auto-created)
- `public/` – HTML/CSS/JS frontend (served statically)

## API
| Method | Endpoint | Access |
|---|---|---|
| POST | /api/register, /api/login | public |
| GET | /api/listings?q=&city=&category= | public |
| POST | /api/listings | donor |
| POST | /api/listings/:id/claim | receiver |
| DELETE | /api/listings/:id | donor (owner) |
| GET | /api/me/listings | logged in |
| GET | /api/stats | public |
