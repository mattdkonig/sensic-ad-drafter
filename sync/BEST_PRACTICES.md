# Google Sheets Best Practices for Ad Drafter Sync

To ensure the `sync-bibles.mjs` script correctly parses the client bibles and updates the Ad Drafter UI, please follow these best practices when setting up or modifying the Google Sheets:

## 1. Header Row
- The script automatically searches for the header row by looking for a column named **"Uploaded"** or **"Status"**.
- **Best Practice:** Keep the header row as close to Row 1 as possible. Avoid putting random notes or empty rows above the header row if you can help it.

## 2. Standard Column Names
The script uses fuzzy matching to find the right columns. Ensure your columns contain these keywords (case-insensitive):

| Required Field | Acceptable Column Names in Sheet |
| :--- | :--- |
| **Upload Status** | `Uploaded`, `Status` |
| **Concept Name** | `Creative Description`, `Description`, `Name` |
| **Objective** | `Objective` |
| **Type** | `Type` |
| **Number of Creatives** | `# of creatives`, `number of creatives` |
| **Primary Text** | `Primary Text`, `Body Copy` |
| **Headline** | `Headline` |
| **Call to Action** | `CTA`, `Call to Action` |
| **Landing Page** | `Landing Page URL`, `Landing Page` |
| **Campaign Name** | `Campaign Name` |
| **Ad Set Name** | `Ad Set Name` |
| **Drive Folder** | `Link to Creatives`, `GDrive`, `Drive` |

## 3. Data Formatting
- **Status:** To mark a row as ready/uploaded, use `TRUE`, `YES`, `UPLOADED`, or `CLIENT_APPROVED` in the Status column.
- **Concept Name:** Do not use "e.g." in the concept name. The script automatically skips rows where the concept contains "e.g." (assuming they are example rows).
- **Number of Creatives:** Ensure this is a valid number (e.g., `3`, not `three`).

## 4. Multiple Tabs (GIDs)
If a client has multiple tabs (e.g., Chief AUS and Chief USA), each tab has a unique `gid` in its URL.
To add a new tab to the sync script:
1. Open the specific tab in Google Sheets.
2. Look at the URL and copy the `gid=...` value.
3. Add it to the `SHEET_URLS` object in `sync-bibles.mjs`.

## 5. Permissions
Currently, the script uses a public API key, which means **the Google Sheets must be set to "Anyone with the link can view"**. 
*(If we want to support private sheets in the future, we will need to add the Service Account JSON credentials to the project and update the script to authenticate).*
