# Denish Makadiya — Unity Developer Portfolio

Live site: **https://denishphibonacci.github.io/PranVeda/**
Admin panel: **https://denishphibonacci.github.io/PranVeda/admin.html**

Everything runs on **GitHub Pages**. There is no server and nothing to install.
The repository itself is the database:

| File / folder | What it holds |
|---|---|
| `data.json` | profile, career, skills, site texts and all projects |
| `uploads/` | images, videos, APKs/packages and the resume uploaded from the admin panel |

When you save in the admin panel, it commits `data.json` and any uploaded files to this repo with the GitHub API.
GitHub Pages then rebuilds the site, which takes about 1 minute.

## Pages

- `index.html`: home page (hero, projects with Games / Plugins / Unity Assets filters, about, experience, skills, contact)
- `project.html?slug=…`: a project page with video, gallery, APK download, Play Store / Asset Store links
- `profile.html`: full profile / resume page (can be printed or saved as PDF)
- `admin.html`: "Dev HQ" admin panel

## First-time admin login

1. Create an access key. On GitHub go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - **Repository access:** Only select repositories → `PranVeda`
   - **Permissions → Repository permissions → Contents:** Read and write
   - Click **Generate token** and copy it
2. Open `admin.html`, paste the key and click **Press start**.

The key is stored only in your browser. Never share it or put it in a file in this repo.

## Extra features (all free)

| Feature | Where to set it up in the admin |
|---|---|
| ▶ Play in browser (Unity WebGL) | Project editor → *Play in browser*: upload the zipped WebGL build (Compression Format: **Disabled**, or Decompression Fallback on) |
| QR code for APK download | Automatic on project pages (desktop) when a download is set |
| Contact form → your inbox | World settings → Integrations → Web3Forms access key (free at web3forms.com) |
| Visitor analytics | World settings → Integrations → GoatCounter code (free at goatcounter.com); counts visits, downloads and plays |
| Docs & Changelog tabs | Project editor → *Documentation* / *Changelog* |
| Testimonials | World settings → Testimonials (real feedback only) |
| GitHub repos section | World settings → Open-source repos |
| Backup / restore | Config → Backup & restore |

## Contact page

`contact.html` has a project form (type, budget, timeline), contact cards with copy-email, your live local time,
a "how we'll work" section and an FAQ. Set the reply-time note, time zone and FAQ in **World settings**.
Messages go to your inbox through Web3Forms (key in World settings → Integrations).

## Job Radar (private)

Admin → **Job Radar** finds jobs that match your profile every 6 hours and sends new ones to Telegram.
Everything is stored in a separate **private** repo (`job-radar`), so nobody can see your job search.

1. Create a private repo `job-radar` (tick *Add a README file*).
2. Edit your fine-grained access key: add the `job-radar` repo with **Contents**, **Workflows** and **Actions** set to *Read and write*.
3. Admin → Job Radar → **Setup** → *Install radar*.
4. Fill **Search profile**: titles, skills, cities/countries, job types, and a free Adzuna key for India/city search.
5. Set up **Telegram**: create a bot with @BotFather, paste the token, find your chat ID, then send a test message.

**My applications** (Job Radar tab) tracks every job you applied to: status (Saved → Applied → Interview → Offer / Rejected / Withdrawn),
next step with a date (overdue ones turn orange), notes, and a cover letter made from your profile.
Click **✓ Applied** on a radar job to add it, or **Add application** for jobs from LinkedIn, Naukri or referrals.
Marking a job as applied only records it — nothing is sent. Apply on the company's site with **Open ↗**.

Sources: Adzuna (19 countries incl. India, by city), Remotive, Remote OK, Himalayas, Arbeitnow.
LinkedIn, Naukri and Indeed don't allow automatic reading, so the Jobs tab gives one-click searches for them.

## Limits

- GitHub accepts files up to **100 MB**. For a bigger APK:
  1. In the repo, open **Releases → Draft a new release** and attach the APK.
  2. Copy the file link into the project's **External download link** field.
- Prefer **YouTube links** for gameplay videos; they keep the repo small.
- The contact form opens the visitor's email app, because Pages has no server.

## Editing on your computer

The admin panel commits straight to GitHub. If you also edit files locally, always **Fetch / Pull** in GitHub Desktop first, so you have the latest `data.json`.
