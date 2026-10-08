# PBL Activity 3: Complex Problem Solving (CPS)
## FoodBridge – An SDG-Oriented Web Application for Surplus Food Sharing

**Course:** Web Application Development  **Domain:** Food Security & Waste Reduction
**SDGs addressed:** SDG 2 (Zero Hunger) – primary; SDG 12 (Responsible Consumption and Production) – secondary; SDG 13 (Climate Action) – indirect

---

## 1. Introduction
Globally, roughly one-third of food produced is lost or wasted, while hundreds of millions of people face hunger. Surplus food from restaurants, events, bakeries and households is often discarded simply because no quick channel exists to connect it with people who need it. FoodBridge is a web application that provides that channel.

## 2. Problem Statement
Design and build a full-stack web application that allows food donors to post surplus food and lets receivers (NGOs, shelters, individuals) discover and claim it before it expires, while tracking measurable impact.

### 2.1 Why this is a complex problem
- **Multiple stakeholders** with different needs (donors, receivers).
- **Time sensitivity:** food expires, so listings must auto-hide and claims must be race-safe.
- **Trust and security:** user accounts, role-based permissions, protection of data.
- **Usability:** donors are busy; the posting flow must be fast and work on mobile.
- **Measurability:** SDG alignment requires indicators, not just claims.

## 3. Objectives
1. Enable donors to post surplus food in under one minute.
2. Let receivers search/filter by city, category and keyword.
3. Prevent double claims and expired listings.
4. Show real-time impact metrics (meals shared, food waste and CO₂e avoided).
5. Apply secure web development practices.

## 4. SDG Mapping
| SDG / Target | How FoodBridge contributes |
|---|---|
| SDG 2 – Zero Hunger (2.1 access to safe, nutritious food) | Redirects surplus edible food to people in need |
| SDG 12.3 – Halve per-capita food waste | Reduces waste at retail/consumer level by fast redistribution |
| SDG 13 – Climate Action | Avoided food waste lowers methane/CO₂e emissions (estimated on dashboard) |
| SDG 17 – Partnerships | Connects businesses, NGOs and citizens on one platform |

## 5. System Design
### 5.1 Architecture
Three-tier: **Presentation** (HTML/CSS/JavaScript SPA-style page) → **Application** (Node.js REST API using the built-in `http` module) → **Data** (JSON file store `data.json`).

### 5.2 Technology stack
| Layer | Technology | Reason |
|---|---|---|
| Frontend | HTML5, CSS3 (responsive grid/flex), vanilla JS (fetch API) | Lightweight, no build step, fast on low-end devices |
| Backend | Node.js (built-in `http`, `crypto`, `fs`) | Zero dependencies: runs with just `node server.js` |
| Auth | scrypt password hashing, HMAC-signed expiring token (Node `crypto`) | No plain-text passwords; stateless sessions |
| Storage | JSON file | Zero setup for a demo; replaceable with MongoDB/PostgreSQL |

### 5.3 Data model
- **User:** id, name, email (unique), role (`donor` | `receiver`), password hash
- **Listing:** id, donorId, title, description, category, servings, city, address, expiresAt, status (`available` | `claimed`), claimedBy, createdAt

### 5.4 REST API
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | /api/register | Public | Create account with role |
| POST | /api/login | Public | Authenticate, return token |
| GET | /api/listings | Public | Search/filter active listings |
| POST | /api/listings | Donor | Post surplus food |
| POST | /api/listings/:id/claim | Receiver | Claim a listing |
| DELETE | /api/listings/:id | Donor (owner) | Remove own listing |
| GET | /api/me/listings | Auth | Own posts / own claims |
| GET | /api/stats | Public | SDG impact indicators |

### 5.5 Workflow
Donor registers → posts food → listing appears publicly sorted by soonest expiry → receiver logs in → claims → listing becomes `claimed`, stats update, donor sees who claimed.

## 6. Key Implementation Details
- **Role-based access control:** server checks `req.user.role` for each protected action (a receiver cannot post; a donor cannot claim).
- **Expiry handling:** listings past `expiresAt` are excluded from public queries.
- **Double-claim prevention:** the claim endpoint checks `status === 'available'` and returns HTTP 409 otherwise (Node's single-threaded handler makes this check-and-set atomic for this storage model).
- **Impact metrics:** `meals = Σ servings of claimed listings`; `food waste avoided ≈ 0.4 kg × meals`; `CO₂e avoided ≈ 2.5 kg × kg food waste`. These conversion factors are assumptions for demonstration and should be replaced with sourced values (e.g., FAO/WRAP) in production.
- **Security:** hashed and salted passwords, constant-time comparisons, input trimming and length limits, output escaping on the client to prevent XSS, token expiry (24 h).

## 7. Testing
| # | Test case | Expected result |
|---|---|---|
| 1 | Register with duplicate email | 409 error shown |
| 2 | Register with password < 6 chars | 400 error |
| 3 | Login with wrong password | 401 error |
| 4 | Receiver tries to POST /api/listings | 403 error |
| 5 | Donor posts valid listing | Appears in public list |
| 6 | Two receivers claim the same item | First succeeds, second gets 409 |
| 7 | Listing past expiry time | Not shown in list |
| 8 | Filter by city/category/keyword | Only matching items shown |
| 9 | Resize to mobile width | Layout stacks; usable |
| 10 | Insert `<script>` in title | Rendered as text, not executed |

## 8. Impact and Outcomes
- Provides a direct, low-cost route for surplus food to reach people before expiry.
- Transparent dashboard supports measurement of SDG contribution.
- Can scale to NGOs, campus canteens, hostels and wedding/event caterers.

## 9. Challenges and Solutions
| Challenge | Solution |
|---|---|
| Food expires quickly | Mandatory expiry time; auto-hide expired items; sort by soonest |
| Fraud / misuse | Role-based accounts, authentication, owner-only deletion |
| Low digital literacy | Simple forms, minimal fields, responsive layout |
| Quantifying SDG impact | Computed indicators on public dashboard |

## 10. Limitations and Future Scope
- Replace JSON storage with a database (MongoDB/PostgreSQL) for concurrency and scale.
- Add map/geolocation search, image upload, and SMS/email/push notifications.
- Add food-safety guidelines, ratings/verification of donors and NGOs, and an admin panel.
- Add multilingual support and PWA offline mode.
- Add automated tests (Jest/Supertest) and HTTPS deployment.

## 11. Conclusion
FoodBridge demonstrates how a focused full-stack web application can address a real sustainability problem. It applies web development fundamentals (REST API design, authentication, role-based access, responsive UI, validation, security) to advance SDG 2 and SDG 12 with measurable outcomes.

## 12. References
- United Nations, *Sustainable Development Goals* – sdgs.un.org
- FAO, *The State of Food and Agriculture* / Food Loss and Waste reports
- UNEP, *Food Waste Index Report*
- Express.js documentation; MDN Web Docs; OWASP Top 10
