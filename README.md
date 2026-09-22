# GharKaBite prototype

Next.js 16 app for a local meal kitchen. Meals, daily menus, subscriptions and orders are stored in MongoDB. Checkout offers cash on delivery and a **demo payment simulator**. The simulator does not take card details or move money; never present it as a real gateway.

## Run locally

Use Node.js 20.9 or later. Run `npm ci`, copy `.env.example` to `.env.local`, fill the required values, then run `npm run dev`. Visit `http://localhost:3000`. `.env.local` is ignored by Git; keep secrets out of source files and screenshots.

The first menu request seeds eight example meals and the Trial, Weekly and Monthly plans only if their collections are empty. Existing records are not overwritten. Register an account, then change its `role` to `admin` in MongoDB Atlas to create the first owner. Admin routes also check authorization server-side.

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
| `KITCHEN_LATITUDE`, `KITCHEN_LONGITUDE` | Private center of the delivery radius. Never use `NEXT_PUBLIC_` for these. |
| `MAX_DELIVERY_RADIUS_KM` | Straight-line limit, default `5`. |

The current prototype has no Cloudinary, Geoapify or kitchen-coordinate values configured. Existing local meal images remain selectable. Address verification and order placement fail closed until the Geoapify key and kitchen coordinates are supplied. There is no keyword-only delivery fallback.

## Admin and checkout

- `/admin/meals` edits the catalogue and today/tomorrow overrides. Daily stock is shared across lunch and dinner. Archived meals disappear from future menus while past order snapshots remain intact.
- `/admin/subscriptions` lists customers and lets the owner edit plan offerings and pause, resume or cancel active subscriptions. A pause extends expiry on resume.
- Customers can select today or tomorrow in `/menu`, add meals to one-date, one-period carts, use one eligible plan credit per order, and track database orders. Using a plan credit makes delivery free.
- COD orders are created immediately. Demo payment lets testers choose success or failure. A failed attempt creates no order or subscription. Prices, stock, capacity, plan use and delivery are rechecked server-side; MongoDB transactions and idempotency keys guard duplicate submissions.
- The homepage checker needs a sufficiently specific address. Ambiguous geocoding results are rejected. Kitchen coordinates never appear in API responses or structured data.

## Vercel deployment preparation

1. Create a MongoDB Atlas replica-set cluster, database user and network access rules. Give Vercel access without exposing the URI in code. Use a separate test database for integration tests.
2. Create free-tier Cloudinary and Geoapify accounts, add their credentials in Vercel environment settings, and set the private kitchen coordinates. Cloudinary images require a redeploy after setting its cloud name because Next/Image remote patterns are built from it.
3. Set `SITE_URL` and `NEXTAUTH_URL` to the final HTTPS domain, generate a fresh `AUTH_SECRET`, connect the repository to Vercel, and run `npm run build` before release. Configure a custom domain in Vercel and add the DNS records it shows; then verify the canonical URL, sitemap and robots output.
4. Keep the demo gateway visibly labeled. Before collecting real money, replace it with Razorpay server-created orders, server-verified signatures and webhooks; add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` only then. If replacing Geoapify with Google Maps later, restrict browser keys by domain and API, server keys by API and service account context, and review usage and billing limits. Neither provider is used for real payment or Google Maps in this prototype.
5. Have the privacy, terms and refund text reviewed before commercial launch. Supply a real contact channel and verify food-business information and claims.

Deployment is prepared here; the site is not published by this repository change.

## Checks

Run `npm run lint`, `npm run build`, and `npm test`. With provider credentials and an isolated database, exercise homepage delivery checks, today/tomorrow menus, filters, cart totals, login, COD, demo success/failure, order tracking, admin status, stock, kitchen capacity, plan purchase/use, reorder and mobile layouts. Tests should verify concurrent stock and idempotency behavior, not just UI labels.
