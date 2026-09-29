# Accounts, Data, and Flight Status

This implementation adds Firebase email/password sign-in, encrypted per-user profiles and trip history, consent-based passport retention, account deletion, scheduled expiry cleanup, and an on-demand flight-status check.

## Data Handling

- Firebase ID tokens identify the account. Every profile, document, validation, chat, and flight-status request requires a verified token.
- Profile fields and trip history are encrypted by Cloud KMS before they are written to Firestore. Firestore stores ciphertext and an update timestamp, not readable profile fields. The encrypted profile is limited to 48 KiB per user.
- Original passport files are retained only after the user checks the separate consent box. They are written to a private Cloud Storage bucket using a KMS key. The bucket must have uniform access, public access prevention, and no object versioning/soft-delete retention if deletion is expected to be immediate.
- A passport copy is removed 30 days after the printed expiry date. Replacing or revoking consent deletes the saved copy and extracted passport fields. Retained passports must have a readable expiry date; the upload is not retained when that date cannot be read.
- Users can delete saved profile/history and all their passport objects from the account screen. Firebase sign-in credentials are not deleted by this action.
- Emergency contact name, phone, and relationship are saved immediately into a separate UID-scoped Firestore record encrypted by Cloud KMS; users can update or clear it without editing the trip profile. It remains until cleared or the saved data is deleted.
- Four languages have locally maintained copy. Signed-in users can select additional languages; Cloud Translation translates the UI and caches it in that browser. Have native speakers review safety-critical wording before real travellers rely on it.
- Speech recordings are sent to Google Speech-to-Text but are not persisted; the transcript is sent to Gemini for the reply. Google Text-to-Speech audio is generated on demand and not stored. These services process user text/audio, so disclose them in the privacy notice.
- Passport and other documents are sent to the configured Gemini model for extraction. Review Google Cloud Vertex AI data-processing terms and your privacy notice/consent before inviting real users.
- This is a set of technical controls, not a legal-compliance certification. Complete a privacy/security review for applicable laws, data-subject requests, breach response, vendor terms, and operational access before production use.

## Flight Status Boundary

The integration uses [Aviationstack](https://aviationstack.com/pricing). Its published free plan lists real-time flight data, 100 requests per month, and non-commercial use. The backend enforces a shared 100-request calendar-month limit plus a 10-request per-account limit. The UI checks status only when the user taps the button. It does not send automatic delay/cancellation alerts and does not guarantee completeness or freshness. Confirm the provider's current terms and coverage for your flight routes. Commercial use or dependable push alerts requires a provider plan/contract that permits it.

## Google Language and Speech APIs

The app uses Cloud Translation for interface strings outside its four maintained local translations, Speech-to-Text V1 for short WebM/OGG voice questions, and Text-to-Speech for spoken answers. Gemini replies in the selected language, with a Google-translated English version alongside it. API usage is authenticated, capped, and not cached server-side.

Current deployment caps are 400,000 translation characters app-wide / 50,000 per account monthly; 3,000,000 TTS characters app-wide / 200,000 per account; 50 STT recordings app-wide / 15 per account (the browser limits each to 20 seconds); and 500 Gemini chat requests app-wide / 100 per account. Flight limits are separate. These are application guards, not Google Cloud billing budgets; configure Cloud Billing budgets and alerts too.

Google currently advertises a $10 monthly NMT Translation credit (equivalent to 500,000 characters), up to 4 million monthly characters for Standard TTS, and 60 minutes/month free for Speech-to-Text V1 without data logging. The deployment caps are below these listed allowances: 400k translation characters, 3m TTS characters, and at most 50 synchronous STT requests app-wide per UTC month. Gemini/Vertex AI is separately capped by request count and may incur charges. Billing must be enabled; set Cloud Billing budgets and alerts, and review the current [Translation pricing](https://cloud.google.com/translate/pricing), [TTS pricing](https://cloud.google.com/text-to-speech/pricing), and [STT pricing](https://cloud.google.com/speech-to-text/pricing). Google billing windows/eligibility may differ from the app's UTC calendar-month counters.

## Provision GCP Before Deploying

The backend Cloud Build deploy now expects the resources and secret below to exist. Create these in the same project and `us-central1` region as the current services. Existing Firestore database locations cannot be changed; verify the current database before proceeding.

1. In Firebase Console, add Firebase to the existing GCP project, enable **Authentication > Email/Password**, and create a Firebase Web App. Add its API key, auth domain, project ID, and app ID to the frontend Cloud Build trigger substitutions `_VITE_FIREBASE_API_KEY`, `_VITE_FIREBASE_AUTH_DOMAIN`, `_VITE_FIREBASE_PROJECT_ID`, and `_VITE_FIREBASE_APP_ID`. Add the deployed frontend domain to Firebase Authentication's authorized domains. Restrict the web API key to the app's domains and the Firebase Identity Toolkit API.

   For local development, copy `frontend/.env.example` to `frontend/.env.local` and fill in the web-app settings. These are browser configuration values, not service-account credentials; still apply API-key restrictions.

2. Create or verify a Firestore Native database in `us-central1`:

   ```sh
   gcloud services enable firestore.googleapis.com --project="$PROJECT_ID"
   gcloud firestore databases create --database="(default)" --location=us-central1 --type=firestore-native --project="$PROJECT_ID"
   ```

   If `(default)` already exists, do not run the create command; verify its location instead.

3. Create the KMS key and private passport bucket. The names must match the backend Cloud Build configuration (`myfirstflight/pii` and `$PROJECT_ID-mff-passports`):

   ```sh
   gcloud services enable cloudkms.googleapis.com storage.googleapis.com translate.googleapis.com texttospeech.googleapis.com speech.googleapis.com --project="$PROJECT_ID"
   gcloud kms keyrings create myfirstflight --location=us-central1 --project="$PROJECT_ID"
   gcloud kms keys create pii --keyring=myfirstflight --location=us-central1 --purpose=encryption --project="$PROJECT_ID"
   gcloud storage buckets create "gs://$PROJECT_ID-mff-passports" --location=us-central1 --uniform-bucket-level-access --public-access-prevention --project="$PROJECT_ID"
   gcloud storage buckets update "gs://$PROJECT_ID-mff-passports" --default-encryption-key="projects/$PROJECT_ID/locations/us-central1/keyRings/myfirstflight/cryptoKeys/pii"
   gcloud storage buckets update "gs://$PROJECT_ID-mff-passports" --soft-delete-duration=0s
   ```

   Ensure object versioning is off. Soft delete defaults to seven days on new buckets, so set it to zero if immediate deletion is required; otherwise deleted copies remain recoverable during the configured retention window. Keep old KMS key versions enabled while ciphertext encrypted with them still exists; key rotation does not re-encrypt existing profile ciphertext.

4. Create the dedicated Cloud Run runtime service account and grant only the required access. The backend Cloud Build file selects this account, so it must exist before a deploy:

   ```sh
   gcloud iam service-accounts create myfirstflight-run --project="$PROJECT_ID"
   gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/datastore.user
   gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/aiplatform.user
   gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudtranslate.user
   gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/texttospeech.user
   gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/speech.client
   gcloud storage buckets add-iam-policy-binding "gs://$PROJECT_ID-mff-passports" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.objectUser
   gcloud kms keys add-iam-policy-binding pii --keyring=myfirstflight --location=us-central1 --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/cloudkms.cryptoKeyEncrypterDecrypter
   gcloud secrets add-iam-policy-binding aviationstack-access-key --project="$PROJECT_ID" --member="serviceAccount:myfirstflight-run@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
   ```

   Also grant the Cloud Storage service agent `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the same key so it can apply the bucket's default CMEK. Find its identity with `gcloud storage service-agent --project="$PROJECT_ID"`, then bind that service account on the KMS key. Grant the active Cloud Build deploy identity `roles/iam.serviceAccountUser` on `myfirstflight-run` so it can attach the runtime identity. Do not grant these roles to end users.

5. Create a Secret Manager secret named `aviationstack-access-key`, add the API key from your Aviationstack account, and grant `myfirstflight-run` access to that secret. The backend Cloud Build deploy references its latest version. Do not place the key in frontend variables, source code, or Cloud Build substitutions.

6. Enable Cloud Scheduler, create its OIDC identity, and create a daily cleanup job:

    ```sh
    gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT_ID"
    gcloud iam service-accounts create passport-cleanup --project="$PROJECT_ID"
    gcloud scheduler jobs create http passport-retention-daily \
       --project="$PROJECT_ID" --location=us-central1 --schedule="15 3 * * *" --time-zone="Etc/UTC" \
       --uri="https://myfirstflightai-backend-964832886801.us-central1.run.app/api/internal/expire-passports" \
       --http-method=POST --oidc-service-account="passport-cleanup@$PROJECT_ID.iam.gserviceaccount.com" \
       --oidc-token-audience="https://myfirstflightai-backend-964832886801.us-central1.run.app"
    ```

    The endpoint verifies both the token audience and exact service-account email. The backend deploy configuration expects this identity. If creating the job before the backend is deployed is rejected by your organization policy, deploy the backend first, then create the job.

7. Deploy the backend after steps 2-6, then deploy the frontend after step 1. The frontend trigger must set all four Firebase substitutions; empty defaults intentionally leave sign-in disabled. The backend's public Cloud Run endpoint still enforces Firebase tokens for personal-data routes.

## Before Real Users

Test new-account creation, profile reload on a second browser session, per-user access isolation, passport consent on/off, replacement, unreadable expiry rejection, expiry cleanup, and account deletion. Confirm Firestore contents are ciphertext, verify the bucket is private/CMEK-backed, and confirm no passport contents appear in logs. Run the cleanup endpoint through the actual Scheduler OIDC identity. Treat flight status as user-requested best effort only; the free integration has no push notification path.