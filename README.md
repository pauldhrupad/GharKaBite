# GharKaBite prototype

Live prototype: https://gharkabite.vercel.app · Source: https://github.com/pauldhrupad/GharKaBite

Next.js 16 app for a local food kitchen. Configurable Thalis, daily menus, subscriptions and orders are stored in MongoDB. Food checkout offers manually verified UPI Online Payment and, when enabled, Cash on Delivery. There is no automatic payment gateway. Meal-plan purchases remain a separate no-money preview.

## Run locally

Use Node.js 20.9 or later. Run `npm ci`, copy `.env.example` to `.env.local`, fill the required values, then run `npm run dev`. Visit `http://localhost:3000`. `.env.local` is ignored by Git; keep secrets out of source files and screenshots.

The first menu request seeds four configurable Thalis (Chicken, Fish, Egg and Veg) and the Trial, Weekly and Monthly plans. On an older database, those four existing catalogue records are migrated once in place, preserving slugs, admin-set base prices and past order snapshots; the old duplicate fixed-meal records are deactivated, not deleted. Subsequent admin edits are not overwritten. Back up the catalogue before deploying this product migration. For a solo owner, register one regular account, then change its `role` to `admin` in MongoDB Atlas. Sign in at `/owner/login` to reach `/admin/dashboard`. There is no separate admin registration; admin routes check authorization server-side. Sign out and back in after changing the role so the session receives it.

## Environment variables

| Variable | Use |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string; a replica-set cluster is needed for checkout transactions. |
| `AUTH_SECRET` | Long random Auth.js signing secret. |
| `NEXTAUTH_URL` | Local or deployed site URL used by authentication. |
| `SITE_URL` | Canonical public URL for metadata, robots and sitemap. |
| `CONTACT_EMAIL` | Optional public support email. Leave blank until a real address exists. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Free-tier Cloudinary account for admin image uploads. Secrets remain server-side. |
| `GEOAPIFY_API_KEY` | Free-tier Geoapify key for address suggestions and geocoding. The app proxies requests server-side. |
| `NEXT_PUBLIC_GEOAPIFY_MAPS_KEY` | Separate browser-visible Geoapify key for map tiles. Restrict it to `http://localhost:3000` and the deployed domain in Geoapify. Set it before building or redeploying. Never use the private server key here. |
| `KITCHEN_LATITUDE`, `KITCHEN_LONGITUDE` | Private center of the delivery radius. Never use `NEXT_PUBLIC_` for these. |
| `MAX_DELIVERY_RADIUS_KM` | Straight-line limit, default `5`. |

Production values for Cloudinary, Geoapify and the private kitchen center are configured in Vercel. They are kept out of Git. Existing local meal images remain selectable. A fresh installation must supply its own values; address verification and order placement fail closed until then. There is no keyword-only delivery fallback.

## Admin and checkout

- `/admin/meals` is the Thali builder. The owner can edit included items, single-choice OR groups, multi-choice groups, option prices and stock, add-ons and quantities, and daily availability. Daily Thali stock is shared across lunch and dinner. Archived Thalis disappear from future menus while past order snapshots remain intact.
- `/admin/subscriptions` lists customers and lets the owner edit plan offerings and pause, resume or cancel active subscriptions. A pause extends expiry on resume.
- Customers can select today or tomorrow in `/menu`, customize Thalis, keep distinct variants in a one-date, one-period cart, use one eligible plan credit per order, and track database orders. A plan credit covers one eligible Thali base price and delivery; paid choices and add-ons remain payable.
- Configure UPI name, ID, phone, QR, Business WhatsApp, and method availability at `/admin/settings`. Online orders are created as `payment_pending`; customers pay the stored server-calculated total and submit screenshot + UTR or report WhatsApp proof. Only an admin can verify payment and confirm the order. COD orders are confirmed at creation and can be marked paid after delivery. Prices, stock, capacity, plan use and delivery are rechecked server-side; MongoDB transactions and idempotency keys guard duplicate submissions.
- At `/admin/settings`, the owner can set the minimum subtotal for free local delivery (₹0 means always free) and create percentage or fixed-amount promo codes, either custom or randomly generated. Codes can have a minimum subtotal, percentage cap and expiry, and can be disabled or deleted. Deletion hides and invalidates the code but retains an internal tombstone so past orders and one-use history remain intact; deleted code names cannot be reused. Each signed-in account can redeem each code only once; redemption is recorded on the order and protected by a unique database index, including for concurrent checkouts. The existing `WELCOME10` code remains available unless disabled or deleted by the owner. The cart and checkout show estimated prices; final Thali configuration, stock and pricing are recalculated from current database settings when the order is placed. Guest shoppers must sign in before applying a code.
- Payment screenshots are uploaded to Cloudinary and retrieved through an authenticated order endpoint. Do not share their Cloudinary URLs. QR upload and website proof submission require Cloudinary credentials; WhatsApp proof requires a configured Business WhatsApp number. The current meal-plan purchase preview still collects no money.
- The homepage, profile and checkout offer an optional map pin or current-location picker. Browser permission is requested only when the user clicks the current-location button. A pin must resolve to a full street and PIN; the customer still enters their house/flat. Manual typing remains available if location access or the map is unavailable. Both paths are rechecked at order placement. Kitchen coordinates never appear in API responses or structured data.

## Vercel deployment preparation

1. Create a MongoDB Atlas replica-set cluster, database user and network access rules. Give Vercel access without exposing the URI in code. Use a separate test database for integration tests.
2. Create free-tier Cloudinary and Geoapify accounts, add their credentials in Vercel environment settings, and set the private kitchen coordinates. Create a separate Geoapify browser key restricted to your production and localhost origins for `NEXT_PUBLIC_GEOAPIFY_MAPS_KEY`. Redeploy after setting it: public variables are embedded at build time. Cloudinary images likewise require a redeploy after setting its cloud name because Next/Image remote patterns are built from it.
3. Set `SITE_URL` and `NEXTAUTH_URL` to the final HTTPS domain, generate a fresh `AUTH_SECRET`, connect the repository to Vercel, and run `npm run build` before release. Configure a custom domain in Vercel and add the DNS records it shows; then verify the canonical URL, sitemap and robots output.
4. Before enabling Online Payment, enter and double-check your actual UPI details and QR in `/admin/settings`. Make a small controlled test payment, verify the bank/UPI statement, submit proof, and test admin confirmation and rejection. Never treat a screenshot or UTR alone as proof that money arrived. Set a real Business WhatsApp number if you offer that option. This is manual verification, not a gateway; there are no gateway credentials or webhooks. If replacing Geoapify with Google Maps later, restrict browser and server keys appropriately.
5. Have the privacy, terms and refund text reviewed before commercial launch. Supply a real contact channel and verify food-business information and claims.

The prototype is deployed on Vercel with GitHub connected to the `main` branch. The canonical URL is `https://gharkabite.vercel.app`. To move to a custom domain, add it in Vercel, follow the DNS instructions there, then update `SITE_URL` and `NEXTAUTH_URL` for Production and redeploy. No live payment gateway is enabled.

## Checks

Run `npm run lint`, `npm run build`, and `npm test`. With provider credentials and an isolated database, exercise the Thali builder, required OR choices, multi-choice limits, optional add-ons, variant cart/edit, checkout snapshots, subscription base-only coverage, stock, reorder, homepage delivery checks, login, COD, all three UPI methods, QR upload, screenshot proof, WhatsApp proof, rejection and resubmission, admin verification, order tracking, kitchen capacity and mobile layouts. Tests should verify concurrent stock and idempotency behavior, not just UI labels.
