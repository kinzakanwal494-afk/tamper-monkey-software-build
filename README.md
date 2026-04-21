# StudyGuide AI Automation – Tampermonkey UserScript

A complete browser automation tool that controls **ChatGPT** and **Gemini** to generate structured study guides and posts the output directly to **Google Docs** via Google Apps Script.

---

## Architecture (from diagram)

```
┌─────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────────┐
│  INPUT PIPELINE         │     │  PROCESSING              │     │  OUTPUT FORMAT               │
├─────────────────────────┤     ├──────────────────────────┤     ├──────────────────────────────┤
│ • Exams Verification    │     │ Weight Domain &          │     │ #DOMAIN                      │
│ • Outline Mapping       │ ──► │ Subdomain Structure      │ ──► │ ##SUBDOMAIN                  │
│ • Sample Question Map   │     │                          │     │ ###ANY TOPIC HEADING         │
│ • Chapters Structure    │     │ All Types Detection &    │     │                              │
│ • Practice Question     │     │ Structure Implementation │     │ Referenced content + Tables  │
│   Structure             │     ├──────────────────────────┤     │ Visual Area: Images,         │
└─────────────────────────┘     │ • Overview               │     │ Diagrams, Charts, Arts       │
                                │ • Main Purpose/Target    │     └──────────────────────────────┘
                                │ • Memory Check           │
                                └──────────────────────────┘
                                         │
                                         ▼
                        ┌────────────────────────────────┐
                        │  PRACTICE SECTION              │
                        │  Math Base, Charts, Graphs     │
                        │  Practice Question Generation  │
                        └────────────────────────────────┘

CONTROLS: [STOP] [PAUSE] [RESUME] [RETRY] [ERRORS] [ANALYZER]
```

---

## Files

| File | Description |
|------|-------------|
| `studyguide_automation.user.js` | Tampermonkey userscript – the main UI app |
| `google_apps_script/Code.gs` | Google Apps Script – receives data and writes to Google Doc |

---

## Setup Instructions

### Step 1 – Install Tampermonkey

1. Install the [Tampermonkey browser extension](https://www.tampermonkey.net/)
2. Click the Tampermonkey icon → **Create a new script**
3. Delete all default content and paste the full contents of `studyguide_automation.user.js`
4. Press **Ctrl+S** to save

### Step 2 – Deploy Google Apps Script

1. Go to [script.google.com](https://script.google.com) and create a **New Project**
2. Delete all default code and paste the full contents of `google_apps_script/Code.gs`
3. Click **Deploy** → **New deployment**
4. Type: **Web app**
5. Execute as: **Me**
6. Who has access: **Anyone**
7. Click **Deploy** and copy the **Web App URL**

### Step 3 – Get Your Google Doc ID

1. Open the Google Doc where you want the study guide written
2. Copy the long ID from the URL:
   ```
   https://docs.google.com/document/d/THIS_IS_YOUR_DOC_ID/edit
   ```

### Step 4 – Configure the Panel

1. Open **ChatGPT** (`chatgpt.com`) or **Gemini** (`gemini.google.com`)
2. The StudyGuide AI panel appears in the **top-right corner**
3. Fill in:
   - **App Script Web URL** → paste the URL from Step 2
   - **Doc ID** → paste the Doc ID from Step 3
4. Click **💾 Save Configuration**

### Step 5 – Run

1. Type the exam/subject name (e.g. `CompTIA Security+`, `AWS SAA-C03`, `PMP`)
2. Optionally paste syllabus text in the extra context box
3. Click **▶ START**
4. Watch the pipeline run all 11 steps automatically
5. When complete, click **📤 Post to Google Doc**

---

## Pipeline Steps (11 total)

| # | Step | Description |
|---|------|-------------|
| 1 | Exams Verification | Validates exam structure, domains, question counts |
| 2 | Outline Mapping | Maps full domain/subdomain/topic hierarchy |
| 3 | Sample Question Mapping | Identifies question types per domain |
| 4 | Chapters Structure | Builds detailed chapters with tables and memory hooks |
| 5 | Practice Question Structure | Defines question distribution and difficulty split |
| 6 | Domain/Subdomain Weight | Verifies and finalizes all percentage weights |
| 7 | Overview | Generates comprehensive study guide overview |
| 8 | Main Purpose & Target | Defines purpose statement and coverage scope |
| 9 | Memory Check | Creates mnemonics, flashcards, and quick-reference tables |
| 10 | Math / Charts / Graphs | Extracts visual content and ASCII representations |
| 11 | Practice Question Generation | Generates full practice question bank |

---

## Controls

| Button | Action |
|--------|--------|
| ▶ START | Begin the full pipeline |
| ⏸ PAUSE | Pause after current step completes |
| ▶ RESUME | Continue from paused step |
| ⏹ STOP | Abort pipeline immediately |
| ↺ RETRY | Retry the last failed step |
| 📊 ANALYZE | Show statistics about collected data |

---

## Google Doc Output Structure

The script writes a fully formatted document including:

- **Title page** with exam name and timestamp
- **Overview** section with exam metadata
- **Main Purpose & Target Covered**
- **Domain/Subdomain Weight tables** (color-coded)
- **Chapters** with `#DOMAIN`, `##SUBDOMAIN`, `###TOPIC` headings
- **Referenced content** with formatted tables
- **Memory Check** with mnemonics, flashcards, quick-reference tables
- **Visual Area** – ASCII diagrams, Mermaid charts
- **Practice Questions** grouped by domain with answers and explanations
- **Sample Question Mapping** table
- **Practice Structure** distribution table

---

## Supported Platforms

- **ChatGPT** – `chat.openai.com`, `chatgpt.com`
- **Gemini** – `gemini.google.com`, `aistudio.google.com`
