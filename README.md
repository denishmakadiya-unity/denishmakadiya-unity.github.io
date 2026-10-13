# Denish Makadiya — Sr. Unity Developer Portfolio

**Live site:** https://denishmakadiya-unity.github.io/
**Admin panel:** https://denishmakadiya-unity.github.io/admin.html
**Repository:** https://github.com/denishmakadiya-unity/denishmakadiya-unity.github.io

The site runs entirely on **GitHub Pages**. It needs no server and has nothing to install.
The repository is the database:

| File / folder | What it holds |
|---|---|
| `data.json` | profile, career, skills, site texts and all projects |
| `uploads/` | images, videos, APKs, packages, WebGL builds and the resume uploaded from the admin panel |

Each save in the admin panel is one commit to this repo, made through the GitHub API.
GitHub Pages then rebuilds the site, which takes about 1 minute. The admin shows **Live ✓** when the new version is online.

## Pages

| Page | What it shows |
|---|---|
| `index.html` | home page: hero, work (Games / Applications / Websites / Unity Assets), about, services, experience, testimonials, GitHub repos, skills, contact |
| `project.html?slug=…` | one project: video, gallery, Docs and Changelog tabs, Play in browser (WebGL), APK download and QR code, store links |
| `profile.html` | full profile and resume (can be printed or saved as PDF) |
| `contact.html` | project form (type, budget, timeline), contact cards, local time, FAQ |
| `admin.html` | "Dev HQ" admin panel |

## Admin login (username + password)

You log in to the admin panel with a **username and password**.

GitHub only allows saving with an access key. The admin therefore still uses one behind the scenes, but you paste it **only once**.
It is stored **encrypted** in `admin-auth.json` in this repo. Only your username and password can unlock it (PBKDF2-SHA256 with 600,000 rounds, then AES-256-GCM).

**First time:**

1. Create an access key on GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - **Token name:** `Portfolio admin`
   - **Repository access:** Only select repositories → `denishmakadiya-unity.github.io`
   - **Repository permissions → Contents:** Read and write
2. Open the admin panel. On **First-time setup**, paste the key once and choose a username and password (at least 10 characters, letters and numbers).
3. From then on, log in with only your username and password, on any device.

| What you want | Where |
|---|---|
| Change username or password | Config → **Login & password** |
| GitHub key expired | Config → **GitHub access key** → paste a new key and your password |
| Forgot password | Login screen → **Forgot password? Set up login again** → paste a GitHub key and choose a new username and password |
| Log out | **Quit** in the sidebar |

**Keep me logged in** keeps you logged in on that computer. Without it, closing the tab logs you out.
`admin-auth.json` is public, so use a **strong password** that you don't use anywhere else.

## Admin sections

| Section | What you do there |
|---|---|
| HQ | overview, counts, recent saves |
| Inventory | all projects; **Edit**, **Hide / Show** on the website, delete |
| Spawn new | add a Game, Application, Website or Unity Asset |
| Player profile | name, photo, about, contact details, resume upload |
| Career | experience and education |
| Job Radar | automatic job search, My applications tracker, Telegram alerts |
| World settings | site texts, services, testimonials, GitHub repos, contact page, FAQ, integrations |
| Config | repository settings, backup and restore |

A project marked **Hidden** stays in the admin but is not shown on the website. Click **Show** to publish it again.

## Free extras

| Feature | Where to set it up in the admin |
|---|---|
| Play in browser (Unity WebGL) | Project editor → *Play in browser*: upload the zipped WebGL build (Compression Format **Disabled**, or Decompression Fallback on) |
| QR code for APK download | automatic on project pages (desktop) when a download is set |
| Contact form → your inbox | World settings → Integrations → Web3Forms access key (free at web3forms.com) |
| Visitor analytics | World settings → Integrations → GoatCounter code (free at goatcounter.com); counts visits, downloads and plays |
| Docs and Changelog tabs | Project editor → *Documentation* / *Changelog* |
| Testimonials | World settings → Testimonials (real feedback only) |
| GitHub repos section | World settings → Open-source repos |
| Backup and restore | Config → Backup & restore |

## Job Radar (private)

Admin → **Job Radar** finds jobs that match your profile every 6 hours and sends new ones to Telegram.
All job data is stored in a separate **private** repo, `denishmakadiya-unity/job-radar`, so nobody can see your job search.
Job Radar uses its **own access key**, separate from the admin key.

1. Create a **private** repo named `job-radar` in the `denishmakadiya-unity` account and tick **Add a README file**.
2. Create a second fine-grained access key:
   - **Token name:** `job-radar`
   - **Repository access:** Only select repositories → `job-radar`
   - **Repository permissions:** **Contents**, **Workflows** and **Actions** → Read and write
3. Admin → Job Radar → **Setup** → paste it in **Job Radar access key** → **Save key**. You only do this once: the key is locked inside your username and password login, like the admin key.
4. Click **Install radar**.
5. Fill **Search profile**: job titles, skills, cities and countries, job types, and a free Adzuna key for India and city search.
6. Set up **Telegram**: create a bot with @BotFather, paste the bot token, find your chat ID, then send a test message.

Sources: Adzuna (19 countries incl. India, by city), Remotive, Remote OK, Himalayas, Arbeitnow.
LinkedIn, Naukri and Indeed don't allow automatic reading, so the Jobs tab has one-click searches for them.

### My applications

The **My applications** tab tracks every job you applied to:

- **Status:** Saved → Applied → Interview → Offer, or Rejected / Withdrawn.
- **Next step with a date:** due or overdue steps turn orange and move to the top.
- **Notes and job link** for each application.
- **Cover letter:** made from your profile; edit it, copy it, or save it with the application.

Click **✓ Applied** on a radar job to add it, or **Add application** for jobs from LinkedIn, Naukri or referrals.
**✓ Applied only records the job — nothing is sent.** Apply on the company's site with **Open ↗**.

## Limits

- GitHub accepts files up to **100 MB**. For a bigger APK:
  1. In the repo, open **Releases → Draft a new release** and attach the APK.
  2. Copy the file link into the project's **External download link** field.
- Prefer **YouTube links** for gameplay videos; they keep the repo small.

## Editing on your computer

The admin panel commits straight to GitHub. Before editing files locally:

1. In GitHub Desktop, click **Fetch origin**, then **Pull origin**, to get the latest `data.json` and uploads.
2. Make your changes, then **Commit** and **Push**.

Don't save old copies of files from an editor over newer ones. That can bring back an old version of the admin panel or your data.
