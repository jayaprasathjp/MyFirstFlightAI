import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import AuthGate from './components/AuthGate'
import EmergencyContact from './components/EmergencyContact'
import TravelAssistant from './components/TravelAssistant'
import { auth, firebaseConfigured } from './firebase'
import './security.css'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const languages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
]
const basicLanguageCodes = ['en', 'hi', 'ta', 'te']
const copy = {
  en: {
    eyebrow: 'YOUR JOURNEY, MADE CLEARER', title: 'Your first flight,', titleAccent: 'one step at a time.', intro: 'Choose a language, add your travellers, and follow the simple steps. You can ask airport staff for help at any time.', languageStep: 'Language', travellersStep: 'Travellers', reviewStep: 'Document check', chooseLanguage: 'Choose your language', languageHelp: 'All instructions on this page will use this language.', travellers: 'Who is travelling?', travellerHelp: 'Add each person flying. Upload their documents so we can read the ticket and check important details.', addTraveller: 'Add traveller', traveller: 'Traveller', passengerDetails: 'Name and travel documents', remove: 'Remove', name: 'Full name', nameHint: 'Write it exactly as shown on the passport', namePlaceholder: 'For example, Meena Raman', documents: 'Add travel documents', documentsHelp: 'Take a clear photo or choose a PDF. Add the flight ticket first to fill in flight details.', ticket: 'Flight ticket', passport: 'Passport', visa: 'Visa', ticketHint: 'Flight, route and travel date', passportHint: 'Name and expiry date', visaHint: 'Destination and validity', reading: 'Reading document…', extracted: 'Read successfully · change file', chooseFile: 'Choose a photo or PDF', needHelp: 'Do you need help at the airport?', optional: 'Optional', noAssistance: 'No, thank you', wheelchair: 'Wheelchair', mobility: 'Help walking', visual: 'Help seeing', elderly: 'Help for older travellers', other: 'Other help', tripTitle: 'Your flight details', tripHelp: 'These details are read from your ticket. Please check them. You can also type them in.', origin: 'Flying from', destination: 'Flying to', departureDate: 'Flight date', returnDate: 'Return date', returnHint: 'Only if your ticket shows a return flight', airline: 'Airline', flightNumber: 'Flight number', booking: 'Booking code', baggage: 'Baggage allowance', notOnTicket: 'Not shown on ticket', checkTitle: 'What is Step 3?', checkHelp: 'We compare the names on the ticket, passport and visa, and check their dates against your flight. This is a helpful review, not an official approval. Ask the airline or immigration staff if anything is unclear.', checkButton: 'Check these documents', checking: 'Checking documents…', needDocs: 'Add a ticket, passport and visa for every traveller, then check your flight date.', resultTitle: 'Your document check', readyTitle: 'The details appear to match', reviewTitle: 'Please check these details', automated: 'This is an automatic reading and may make mistakes. Please confirm important details with your airline or the official authority.', failed: 'We could not finish the check.', helpTitle: 'Need help at the airport?', helpText: 'Show this to an airport worker. The English sentence is shown first so they can understand.', askDirections: 'Please show us where to go for our flight.', needWheelchair: 'We need wheelchair assistance, please.', speakSlowly: 'We are travelling for the first time. Please speak slowly and help us.', showStaff: 'Show to airport staff', close: 'Close', uploadError: 'We could not read this file. Check your internet connection and try again.', unsupported: 'Choose a PDF or a JPG, PNG or WebP photo.', tooLarge: 'This file is over 10 MB. Choose a smaller file.', checkNames: 'Names on the documents', checkPassport: 'Passport expiry', checkVisa: 'Visa dates', checkMissing: 'Missing documents', checkNamesMessage: 'Check that the names match on the ticket, passport and visa.', checkPassportMessage: 'Check the passport expiry date against the destination’s official rules.', checkVisaMessage: 'Check that the visa is valid for the destination and travel dates.', checkMissingMessage: 'Add a ticket, passport and visa for this traveller.',
  },
  hi: {
    eyebrow: 'आपकी यात्रा, अब और आसान', title: 'पहली हवाई यात्रा,', titleAccent: 'एक-एक कदम करके।', intro: 'भाषा चुनें, यात्रियों के नाम जोड़ें और आसान निर्देशों का पालन करें। ज़रूरत पड़ने पर एयरपोर्ट के कर्मचारी से मदद माँगें।', languageStep: 'भाषा', travellersStep: 'यात्री', reviewStep: 'दस्तावेज़ जाँच', chooseLanguage: 'अपनी भाषा चुनें', languageHelp: 'इस पेज के सभी निर्देश इसी भाषा में दिखेंगे।', travellers: 'कौन यात्रा कर रहा है?', travellerHelp: 'हर यात्री को जोड़ें। टिकट पढ़ने और ज़रूरी जानकारी जाँचने के लिए उनके दस्तावेज़ जोड़ें।', addTraveller: 'यात्री जोड़ें', traveller: 'यात्री', passengerDetails: 'नाम और यात्रा के दस्तावेज़', remove: 'हटाएँ', name: 'पूरा नाम', nameHint: 'पासपोर्ट पर जैसा लिखा है, वैसा ही लिखें', namePlaceholder: 'उदाहरण: Meena Raman', documents: 'यात्रा के दस्तावेज़ जोड़ें', documentsHelp: 'साफ़ फ़ोटो लें या PDF चुनें। पहले टिकट जोड़ें, इससे उड़ान की जानकारी भर जाएगी।', ticket: 'हवाई टिकट', passport: 'पासपोर्ट', visa: 'वीज़ा', ticketHint: 'उड़ान, रास्ता और तारीख़', passportHint: 'नाम और समाप्ति की तारीख़', visaHint: 'जाने की जगह और वैधता', reading: 'दस्तावेज़ पढ़ा जा रहा है…', extracted: 'पढ़ लिया · फ़ाइल बदलें', chooseFile: 'फ़ोटो या PDF चुनें', needHelp: 'क्या एयरपोर्ट पर मदद चाहिए?', optional: 'ज़रूरी नहीं', noAssistance: 'नहीं, धन्यवाद', wheelchair: 'व्हीलचेयर', mobility: 'चलने में मदद', visual: 'देखने में मदद', elderly: 'बुज़ुर्ग यात्री के लिए मदद', other: 'दूसरी मदद', tripTitle: 'आपकी उड़ान की जानकारी', tripHelp: 'यह जानकारी टिकट से पढ़ी गई है। कृपया जाँचें। आप इसे खुद भी भर सकते हैं।', origin: 'कहाँ से उड़ान है', destination: 'कहाँ जाना है', departureDate: 'उड़ान की तारीख़', returnDate: 'वापसी की तारीख़', returnHint: 'सिर्फ़ तब, जब टिकट में वापसी की उड़ान हो', airline: 'एयरलाइन', flightNumber: 'उड़ान नंबर', booking: 'बुकिंग कोड', baggage: 'बैग की सीमा', notOnTicket: 'टिकट पर नहीं है', checkTitle: 'तीसरा कदम क्या है?', checkHelp: 'हम टिकट, पासपोर्ट और वीज़ा पर नाम मिलाते हैं और तारीख़ें आपकी उड़ान से जाँचते हैं। यह सिर्फ़ मदद के लिए जाँच है, सरकारी मंज़ूरी नहीं। कुछ समझ न आए तो एयरलाइन या इमिग्रेशन कर्मचारी से पूछें।', checkButton: 'दस्तावेज़ जाँचें', checking: 'दस्तावेज़ जाँच रहे हैं…', needDocs: 'हर यात्री के लिए टिकट, पासपोर्ट और वीज़ा जोड़ें, फिर उड़ान की तारीख़ जाँचें।', resultTitle: 'दस्तावेज़ जाँच', readyTitle: 'जानकारी ठीक लगती है', reviewTitle: 'कृपया यह जानकारी जाँचें', automated: 'यह स्वचालित जाँच है और इसमें गलती हो सकती है। ज़रूरी जानकारी एयरलाइन या सरकारी विभाग से पक्का करें।', failed: 'जाँच पूरी नहीं हो सकी।', helpTitle: 'एयरपोर्ट पर मदद चाहिए?', helpText: 'यह एयरपोर्ट कर्मचारी को दिखाएँ। पहले अंग्रेज़ी वाक्य है ताकि वे समझ सकें।', askDirections: 'कृपया हमें हमारी उड़ान का रास्ता दिखाएँ।', needWheelchair: 'कृपया हमें व्हीलचेयर की मदद चाहिए।', speakSlowly: 'हम पहली बार यात्रा कर रहे हैं। कृपया धीरे बोलें और हमारी मदद करें।', showStaff: 'एयरपोर्ट कर्मचारी को दिखाएँ', close: 'बंद करें', uploadError: 'यह फ़ाइल पढ़ी नहीं जा सकी। इंटरनेट जाँचें और फिर कोशिश करें।', unsupported: 'PDF या JPG, PNG, WebP फ़ोटो चुनें।', tooLarge: 'यह फ़ाइल 10 MB से बड़ी है। छोटी फ़ाइल चुनें।', checkNames: 'दस्तावेज़ों पर नाम', checkPassport: 'पासपोर्ट की वैधता', checkVisa: 'वीज़ा की तारीख़ें', checkMissing: 'दस्तावेज़ नहीं हैं', checkNamesMessage: 'टिकट, पासपोर्ट और वीज़ा पर नाम मिलाएँ।', checkPassportMessage: 'पासपोर्ट की समाप्ति की तारीख़ को देश के नियमों से जाँचें।', checkVisaMessage: 'जाने की जगह और यात्रा की तारीख़ों के लिए वीज़ा जाँचें।', checkMissingMessage: 'इस यात्री का टिकट, पासपोर्ट और वीज़ा जोड़ें.',
  },
  ta: {
    eyebrow: 'உங்கள் பயணம், இனி எளிதாக', title: 'முதல் விமானப் பயணம்,', titleAccent: 'ஒவ்வொரு படியாக.', intro: 'மொழியைத் தேர்ந்தெடுத்து, பயணிகளைச் சேர்த்து, எளிய வழிமுறைகளைப் பின்பற்றுங்கள். தேவையானால் விமான நிலையப் பணியாளரிடம் உதவி கேளுங்கள்.', languageStep: 'மொழி', travellersStep: 'பயணிகள்', reviewStep: 'ஆவணச் சரிபார்ப்பு', chooseLanguage: 'உங்கள் மொழியைத் தேர்ந்தெடுங்கள்', languageHelp: 'இந்தப் பக்கத்தின் எல்லா வழிமுறைகளும் இந்த மொழியில் காட்டப்படும்.', travellers: 'யார் பயணம் செய்கிறார்கள்?', travellerHelp: 'ஒவ்வொரு பயணியையும் சேர்க்கவும். டிக்கெட்டைப் படித்து முக்கிய விவரங்களைச் சரிபார்க்க ஆவணங்களைச் சேர்க்கவும்.', addTraveller: 'பயணியைச் சேர்', traveller: 'பயணி', passengerDetails: 'பெயரும் பயண ஆவணங்களும்', remove: 'நீக்கு', name: 'முழுப் பெயர்', nameHint: 'பாஸ்போர்ட்டில் உள்ளபடியே எழுதுங்கள்', namePlaceholder: 'எடுத்துக்காட்டு: Meena Raman', documents: 'பயண ஆவணங்களைச் சேர்க்கவும்', documentsHelp: 'தெளிவான படம் எடுக்கவும் அல்லது PDF தேர்ந்தெடுக்கவும். முதலில் டிக்கெட்டைச் சேர்த்தால் விமான விவரங்கள் நிரப்பப்படும்.', ticket: 'விமான டிக்கெட்', passport: 'பாஸ்போர்ட்', visa: 'விசா', ticketHint: 'விமானம், வழி, தேதி', passportHint: 'பெயர், காலாவதி தேதி', visaHint: 'செல்லும் இடம், செல்லுபடி', reading: 'ஆவணம் படிக்கப்படுகிறது…', extracted: 'படிக்கப்பட்டது · கோப்பை மாற்றவும்', chooseFile: 'படம் அல்லது PDF தேர்வு', needHelp: 'விமான நிலையத்தில் உதவி வேண்டுமா?', optional: 'விருப்பம்', noAssistance: 'வேண்டாம், நன்றி', wheelchair: 'சக்கர நாற்காலி', mobility: 'நடக்க உதவி', visual: 'பார்வைக்கு உதவி', elderly: 'முதிய பயணிக்கு உதவி', other: 'மற்ற உதவி', tripTitle: 'உங்கள் விமான விவரங்கள்', tripHelp: 'இந்த விவரங்கள் டிக்கெட்டிலிருந்து படிக்கப்பட்டவை. சரிபார்க்கவும். நீங்களும் தட்டச்சு செய்யலாம்.', origin: 'எங்கிருந்து புறப்படுகிறது', destination: 'எங்கே செல்கிறீர்கள்', departureDate: 'விமான தேதி', returnDate: 'திரும்பும் தேதி', returnHint: 'டிக்கெட்டில் திரும்பும் விமானம் இருந்தால் மட்டும்', airline: 'விமான நிறுவனம்', flightNumber: 'விமான எண்', booking: 'முன்பதிவு குறியீடு', baggage: 'பை எடை வரம்பு', notOnTicket: 'டிக்கெட்டில் இல்லை', checkTitle: 'மூன்றாவது படி என்ன?', checkHelp: 'டிக்கெட், பாஸ்போர்ட், விசாவில் உள்ள பெயர்களையும் உங்கள் விமானத் தேதிகளையும் ஒப்பிடுகிறோம். இது உதவிக்கான சரிபார்ப்பு மட்டுமே; அரசு அனுமதி அல்ல. புரியாதது இருந்தால் விமான நிறுவனம் அல்லது குடியேற்றப் பணியாளரிடம் கேளுங்கள்.', checkButton: 'ஆவணங்களைச் சரிபார்க்கவும்', checking: 'ஆவணங்கள் சரிபார்க்கப்படுகின்றன…', needDocs: 'ஒவ்வொரு பயணிக்கும் டிக்கெட், பாஸ்போர்ட், விசாவைச் சேர்த்து, விமானத் தேதியைச் சரிபார்க்கவும்.', resultTitle: 'ஆவணச் சரிபார்ப்பு', readyTitle: 'விவரங்கள் சரியாகத் தெரிகின்றன', reviewTitle: 'இந்த விவரங்களைச் சரிபார்க்கவும்', automated: 'இது தானியங்கி வாசிப்பு; தவறு இருக்கலாம். முக்கிய விவரங்களை விமான நிறுவனம் அல்லது அதிகாரப்பூர்வ அமைப்பிடம் உறுதிப்படுத்தவும்.', failed: 'சரிபார்ப்பை முடிக்க முடியவில்லை.', helpTitle: 'விமான நிலையத்தில் உதவி வேண்டுமா?', helpText: 'இதை விமான நிலையப் பணியாளரிடம் காட்டுங்கள். முதலில் ஆங்கில வாக்கியம் காட்டப்படும்.', askDirections: 'எங்கள் விமானத்திற்குச் செல்லும் வழியைக் காட்டுங்கள்.', needWheelchair: 'எங்களுக்கு சக்கர நாற்காலி உதவி தேவை.', speakSlowly: 'நாங்கள் முதல் முறையாகப் பயணம் செய்கிறோம். மெதுவாகப் பேசி உதவுங்கள்.', showStaff: 'விமான நிலையப் பணியாளரிடம் காட்டுங்கள்', close: 'மூடு', uploadError: 'இந்தக் கோப்பைப் படிக்க முடியவில்லை. இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.', unsupported: 'PDF அல்லது JPG, PNG, WebP படத்தைத் தேர்ந்தெடுக்கவும்.', tooLarge: 'இந்தக் கோப்பு 10 MB-ஐ விடப் பெரியது. சிறிய கோப்பைத் தேர்ந்தெடுக்கவும்.', checkNames: 'ஆவணங்களில் உள்ள பெயர்கள்', checkPassport: 'பாஸ்போர்ட் காலாவதி', checkVisa: 'விசா தேதிகள்', checkMissing: 'ஆவணங்கள் இல்லை', checkNamesMessage: 'டிக்கெட், பாஸ்போர்ட், விசாவில் பெயர்கள் பொருந்துகிறதா பாருங்கள்.', checkPassportMessage: 'பாஸ்போர்ட் காலாவதி தேதியை அந்த நாட்டின் அதிகாரப்பூர்வ விதிகளுடன் சரிபார்க்கவும்.', checkVisaMessage: 'செல்லும் இடம், பயணத் தேதிகளுக்கு விசா செல்லுபடியாகிறதா பாருங்கள்.', checkMissingMessage: 'இந்தப் பயணிக்கான டிக்கெட், பாஸ்போர்ட், விசாவைச் சேர்க்கவும்.',
  },
  te: {
    eyebrow: 'మీ ప్రయాణం, ఇప్పుడు సులభంగా', title: 'మొదటి విమాన ప్రయాణం,', titleAccent: 'ఒక్కో అడుగుగా.', intro: 'భాషను ఎంచుకుని, ప్రయాణికులను జోడించి, సులభమైన సూచనలను అనుసరించండి. అవసరమైతే విమానాశ్రయ సిబ్బందిని సహాయం అడగండి.', languageStep: 'భాష', travellersStep: 'ప్రయాణికులు', reviewStep: 'పత్రాల తనిఖీ', chooseLanguage: 'మీ భాషను ఎంచుకోండి', languageHelp: 'ఈ పేజీలోని సూచనలన్నీ ఈ భాషలో కనిపిస్తాయి.', travellers: 'ఎవరు ప్రయాణిస్తున్నారు?', travellerHelp: 'ప్రతి ప్రయాణికుడిని జోడించండి. టికెట్ చదివి ముఖ్యమైన వివరాలను తనిఖీ చేయడానికి పత్రాలను జోడించండి.', addTraveller: 'ప్రయాణికుడిని జోడించండి', traveller: 'ప్రయాణికుడు', passengerDetails: 'పేరు, ప్రయాణ పత్రాలు', remove: 'తొలగించండి', name: 'పూర్తి పేరు', nameHint: 'పాస్‌పోర్ట్‌లో ఉన్నట్లుగానే రాయండి', namePlaceholder: 'ఉదాహరణ: Meena Raman', documents: 'ప్రయాణ పత్రాలను జోడించండి', documentsHelp: 'స్పష్టమైన ఫోటో తీయండి లేదా PDF ఎంచుకోండి. ముందుగా టికెట్ జోడిస్తే విమాన వివరాలు నిండుతాయి.', ticket: 'విమాన టికెట్', passport: 'పాస్‌పోర్ట్', visa: 'వీసా', ticketHint: 'విమానం, మార్గం, తేదీ', passportHint: 'పేరు, గడువు తేదీ', visaHint: 'గమ్యం, చెల్లుబాటు', reading: 'పత్రాన్ని చదువుతోంది…', extracted: 'చదివింది · ఫైల్ మార్చండి', chooseFile: 'ఫోటో లేదా PDF ఎంచుకోండి', needHelp: 'విమానాశ్రయంలో సహాయం కావాలా?', optional: 'ఐచ్ఛికం', noAssistance: 'వద్దు, ధన్యవాదాలు', wheelchair: 'వీల్‌చైర్', mobility: 'నడవడంలో సహాయం', visual: 'చూపు సహాయం', elderly: 'వృద్ధ ప్రయాణికుడికి సహాయం', other: 'ఇతర సహాయం', tripTitle: 'మీ విమాన వివరాలు', tripHelp: 'ఈ వివరాలు టికెట్‌ నుంచి చదివినవి. దయచేసి తనిఖీ చేయండి. మీరు స్వయంగా కూడా టైప్ చేయవచ్చు.', origin: 'ఎక్కడి నుంచి విమానం', destination: 'ఎక్కడికి వెళ్తున్నారు', departureDate: 'విమాన తేదీ', returnDate: 'తిరుగు తేదీ', returnHint: 'టికెట్‌లో తిరుగు విమానం ఉంటే మాత్రమే', airline: 'విమాన సంస్థ', flightNumber: 'విమాన నంబర్', booking: 'బుకింగ్ కోడ్', baggage: 'బ్యాగేజీ పరిమితి', notOnTicket: 'టికెట్‌లో లేదు', checkTitle: 'మూడో దశ ఏమిటి?', checkHelp: 'టికెట్, పాస్‌పోర్ట్, వీసాలోని పేర్లను, మీ విమాన తేదీలను పోలుస్తాం. ఇది సహాయానికి చేసే తనిఖీ మాత్రమే; అధికారిక అనుమతి కాదు. ఏదైనా స్పష్టంగా లేకపోతే విమాన సంస్థ లేదా ఇమిగ్రేషన్ సిబ్బందిని అడగండి.', checkButton: 'పత్రాలను తనిఖీ చేయండి', checking: 'పత్రాలను తనిఖీ చేస్తోంది…', needDocs: 'ప్రతి ప్రయాణికుడికి టికెట్, పాస్‌పోర్ట్, వీసా జోడించి, విమాన తేదీని తనిఖీ చేయండి.', resultTitle: 'పత్రాల తనిఖీ', readyTitle: 'వివరాలు సరిపోయినట్లు ఉన్నాయి', reviewTitle: 'ఈ వివరాలను తనిఖీ చేయండి', automated: 'ఇది ఆటోమేటిక్‌గా చదివినది; తప్పులు ఉండవచ్చు. ముఖ్యమైన వివరాలను విమాన సంస్థ లేదా అధికారిక అధికారితో నిర్ధారించండి.', failed: 'తనిఖీ పూర్తి కాలేదు.', helpTitle: 'విమానాశ్రయంలో సహాయం కావాలా?', helpText: 'దీన్ని విమానాశ్రయ సిబ్బందికి చూపండి. వారు అర్థం చేసుకోవడానికి ముందుగా ఇంగ్లీష్ వాక్యం కనిపిస్తుంది.', askDirections: 'దయచేసి మా విమానానికి వెళ్లే దారి చూపండి.', needWheelchair: 'దయచేసి మాకు వీల్‌చైర్ సహాయం కావాలి.', speakSlowly: 'మేము మొదటిసారి ప్రయాణిస్తున్నాం. దయచేసి నెమ్మదిగా మాట్లాడి సహాయం చేయండి.', showStaff: 'విమానాశ్రయ సిబ్బందికి చూపండి', close: 'మూసివేయండి', uploadError: 'ఈ ఫైల్‌ను చదవలేకపోయాం. ఇంటర్నెట్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.', unsupported: 'PDF లేదా JPG, PNG, WebP ఫోటో ఎంచుకోండి.', tooLarge: 'ఈ ఫైల్ 10 MB కంటే పెద్దది. చిన్న ఫైల్ ఎంచుకోండి.', checkNames: 'పత్రాల్లోని పేర్లు', checkPassport: 'పాస్‌పోర్ట్ గడువు', checkVisa: 'వీసా తేదీలు', checkMissing: 'పత్రాలు లేవు', checkNamesMessage: 'టికెట్, పాస్‌పోర్ట్, వీసాలో పేర్లు సరిపోతున్నాయో చూడండి.', checkPassportMessage: 'పాస్‌పోర్ట్ గడువు తేదీని గమ్యస్థాన అధికారిక నియమాలతో తనిఖీ చేయండి.', checkVisaMessage: 'గమ్యం, ప్రయాణ తేదీలకు వీసా చెల్లుబాటు అవుతుందో చూడండి.', checkMissingMessage: 'ఈ ప్రయాణికుడి టికెట్, పాస్‌పోర్ట్, వీసా జోడించండి.',
  },
}
const accountCopy = {
  en: { accountTitle: 'Your travel profile', accountIntro: 'Sign in to keep your trip details and return to them later.', accountPrivacy: 'Your profile is encrypted before it is saved. Passport files are stored privately only when you choose to keep a copy.', firebaseMissing: 'Sign-in is not configured yet. Add the Firebase web app settings to the frontend deployment.', email: 'Email address', password: 'Password', signIn: 'Sign in', createAccount: 'Create account', forgotPassword: 'Forgot password?', haveAccount: 'Already have an account? Sign in', needAccount: 'New here? Create an account', backToSignIn: 'Back to sign in', sendReset: 'Send reset link', resetSent: 'Password reset email sent.', working: 'Please wait…', signInError: 'Email or password is incorrect.', emailInUse: 'An account already uses this email.', weakPassword: 'Use a password with at least 6 characters.', invalidEmail: 'Enter a valid email address.', tryLater: 'Too many attempts. Try again later.', authError: 'We could not sign you in. Check your connection and try again.', storageConsent: 'Save an encrypted passport copy for future trips. It will be removed 30 days after expiry or when replaced.', passportNotStored: 'Passport details are used for this check only and will not be saved to your profile.', passportStored: 'Encrypted passport copy saved', removePassport: 'Delete saved passport', account: 'Signed in', signOut: 'Sign out', deleteData: 'Delete my saved data', deleteConfirm: 'Delete your saved trip history and all passport files? This cannot be undone.', deleteFailed: 'Saved data could not be deleted. Please try again.', saving: 'Saving securely…', saved: 'Saved securely', saveFailed: 'Could not save. Check your connection.', tripHistory: 'Recent trips', loadTrip: 'Open', flightStatus: 'Flight status', statusHelp: 'One live check uses one of the 100 free monthly requests. Updates are best effort, not guaranteed alerts.', checkStatus: 'Check status', statusLoading: 'Checking…', statusUnavailable: 'No flight status available.', statusChecked: 'Checked', statusCancelled: 'Cancelled', statusScheduled: 'Scheduled', statusActive: 'In flight', statusLanded: 'Landed', statusDiverted: 'Diverted', statusUnknown: 'Unknown', noFlight: 'Add the flight number and date first.', statusDelay: 'Delay', statusGate: 'Gate', statusTerminal: 'Terminal', statusFailed: 'Flight status could not be checked.',
  },
  hi: { accountTitle: 'आपकी यात्रा प्रोफ़ाइल', accountIntro: 'अपनी यात्रा की जानकारी सुरक्षित रखने और बाद में देखने के लिए साइन इन करें।', accountPrivacy: 'प्रोफ़ाइल सेव करने से पहले एन्क्रिप्ट होती है। पासपोर्ट की फ़ाइल सिर्फ़ आपकी अनुमति से निजी रूप से सेव होगी।', firebaseMissing: 'साइन-इन अभी सेट नहीं है। फ्रंटएंड में Firebase की जानकारी जोड़ें।', email: 'ईमेल पता', password: 'पासवर्ड', signIn: 'साइन इन', createAccount: 'खाता बनाएँ', forgotPassword: 'पासवर्ड भूल गए?', haveAccount: 'खाता है? साइन इन करें', needAccount: 'नए हैं? खाता बनाएँ', backToSignIn: 'साइन इन पर लौटें', sendReset: 'रीसेट लिंक भेजें', resetSent: 'पासवर्ड रीसेट ईमेल भेजा गया।', working: 'कृपया रुकें…', signInError: 'ईमेल या पासवर्ड गलत है।', emailInUse: 'इस ईमेल से पहले से खाता है।', weakPassword: 'कम से कम 6 अक्षरों का पासवर्ड रखें।', invalidEmail: 'सही ईमेल पता लिखें।', tryLater: 'बहुत कोशिशें हुईं। बाद में फिर प्रयास करें।', authError: 'साइन इन नहीं हो सका। इंटरनेट जाँचकर फिर प्रयास करें।', storageConsent: 'आगे की यात्राओं के लिए पासपोर्ट की एन्क्रिप्टेड प्रति सेव करें। समाप्ति के 30 दिन बाद या नई प्रति जोड़ने पर यह हट जाएगी।', passportNotStored: 'पासपोर्ट की जानकारी सिर्फ़ इस जाँच के लिए है, प्रोफ़ाइल में सेव नहीं होगी।', passportStored: 'एन्क्रिप्टेड पासपोर्ट प्रति सेव है', removePassport: 'सेव पासपोर्ट हटाएँ', account: 'साइन इन है', signOut: 'साइन आउट', deleteData: 'मेरा सेव किया डेटा हटाएँ', deleteConfirm: 'सेव की गई यात्राएँ और पासपोर्ट की सभी फ़ाइलें हटाएँ? इसे वापस नहीं किया जा सकता।', deleteFailed: 'सेव किया डेटा नहीं हट सका। फिर प्रयास करें।', saving: 'सुरक्षित रूप से सेव हो रहा है…', saved: 'सुरक्षित रूप से सेव है', saveFailed: 'सेव नहीं हो सका। इंटरनेट जाँचें।', tripHistory: 'पिछली यात्राएँ', loadTrip: 'खोलें', flightStatus: 'उड़ान की स्थिति', statusHelp: 'हर लाइव जाँच 100 मुफ़्त मासिक अनुरोधों में से एक लेती है। अपडेट की गारंटी नहीं है।', checkStatus: 'स्थिति जाँचें', statusLoading: 'जाँच रहे हैं…', statusUnavailable: 'उड़ान की जानकारी नहीं मिली।', statusChecked: 'जाँच का समय', statusCancelled: 'रद्द', statusScheduled: 'तय है', statusActive: 'उड़ान में', statusLanded: 'उतर गई', statusDiverted: 'दूसरे एयरपोर्ट पर', statusUnknown: 'अज्ञात', noFlight: 'पहले टिकट का उड़ान नंबर और तारीख़ जोड़ें।', statusDelay: 'देरी', statusGate: 'गेट', statusTerminal: 'टर्मिनल', statusFailed: 'उड़ान की स्थिति नहीं जाँच सके।',
  },
  ta: { accountTitle: 'உங்கள் பயணச் சுயவிவரம்', accountIntro: 'பயண விவரங்களைச் சேமித்து பின்னர் பார்க்க உள்நுழையுங்கள்.', accountPrivacy: 'சுயவிவரம் சேமிப்பதற்கு முன் குறியாக்கம் செய்யப்படும். உங்கள் அனுமதி இருந்தால் மட்டுமே பாஸ்போர்ட் தனிப்பட்ட முறையில் சேமிக்கப்படும்.', firebaseMissing: 'உள்நுழைவு இன்னும் அமைக்கப்படவில்லை. Firebase இணையச் செயலி விவரங்களைச் சேர்க்கவும்.', email: 'மின்னஞ்சல் முகவரி', password: 'கடவுச்சொல்', signIn: 'உள்நுழை', createAccount: 'கணக்கை உருவாக்கு', forgotPassword: 'கடவுச்சொல் மறந்துவிட்டதா?', haveAccount: 'கணக்கு உள்ளதா? உள்நுழையுங்கள்', needAccount: 'புதியவரா? கணக்கை உருவாக்குங்கள்', backToSignIn: 'உள்நுழைவுக்குத் திரும்பு', sendReset: 'மீட்டமைப்பு இணைப்பை அனுப்பு', resetSent: 'கடவுச்சொல் மீட்டமைப்பு மின்னஞ்சல் அனுப்பப்பட்டது.', working: 'காத்திருக்கவும்…', signInError: 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.', emailInUse: 'இந்த மின்னஞ்சலில் ஏற்கனவே கணக்கு உள்ளது.', weakPassword: 'குறைந்தது 6 எழுத்துகள் உள்ள கடவுச்சொல் பயன்படுத்தவும்.', invalidEmail: 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.', tryLater: 'பல முயற்சிகள். பின்னர் முயற்சிக்கவும்.', authError: 'உள்நுழைய முடியவில்லை. இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.', storageConsent: 'அடுத்த பயணங்களுக்காக குறியாக்கப்பட்ட பாஸ்போர்ட் நகலைச் சேமிக்கவும். காலாவதியான 30 நாட்களில் அல்லது மாற்றும்போது நீக்கப்படும்.', passportNotStored: 'இந்தச் சரிபார்ப்புக்கு மட்டும் பாஸ்போர்ட் விவரம் பயன்படும்; சுயவிவரத்தில் சேமிக்கப்படாது.', passportStored: 'குறியாக்கப்பட்ட பாஸ்போர்ட் நகல் சேமிக்கப்பட்டது', removePassport: 'சேமித்த பாஸ்போர்ட்டை நீக்கு', account: 'உள்நுழைந்துள்ளீர்கள்', signOut: 'வெளியேறு', deleteData: 'சேமித்த தரவை நீக்கு', deleteConfirm: 'சேமித்த பயண வரலாறு மற்றும் பாஸ்போர்ட் கோப்புகளை நீக்கவா? இதை மீட்டெடுக்க முடியாது.', deleteFailed: 'சேமித்த தரவை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.', saving: 'பாதுகாப்பாகச் சேமிக்கிறது…', saved: 'பாதுகாப்பாகச் சேமிக்கப்பட்டது', saveFailed: 'சேமிக்க முடியவில்லை. இணையத்தைச் சரிபார்க்கவும்.', tripHistory: 'சமீபத்திய பயணங்கள்', loadTrip: 'திற', flightStatus: 'விமான நிலை', statusHelp: 'ஒவ்வொரு நேரடி சரிபார்ப்பும் மாதத்தின் 100 இலவச கோரிக்கைகளில் ஒன்று. அறிவிப்புக்கு உத்தரவாதமில்லை.', checkStatus: 'நிலையைச் சரிபார்', statusLoading: 'சரிபார்க்கிறது…', statusUnavailable: 'விமான நிலை கிடைக்கவில்லை.', statusChecked: 'சரிபார்த்த நேரம்', statusCancelled: 'ரத்து', statusScheduled: 'திட்டமிட்டபடி', statusActive: 'பறக்கிறது', statusLanded: 'தரையிறங்கியது', statusDiverted: 'மாற்று விமான நிலையம்', statusUnknown: 'தெரியவில்லை', noFlight: 'முதலில் டிக்கெட் விமான எண்ணையும் தேதியையும் சேர்க்கவும்.', statusDelay: 'தாமதம்', statusGate: 'கேட்', statusTerminal: 'முனையம்', statusFailed: 'விமான நிலையைச் சரிபார்க்க முடியவில்லை.',
  },
  te: { accountTitle: 'మీ ప్రయాణ ప్రొఫైల్', accountIntro: 'మీ ప్రయాణ వివరాలను భద్రపరచి, తర్వాత చూడటానికి సైన్ ఇన్ చేయండి.', accountPrivacy: 'ప్రొఫైల్ సేవ్ చేసే ముందు ఎన్‌క్రిప్ట్ అవుతుంది. మీ అనుమతితో మాత్రమే పాస్‌పోర్ట్ ఫైల్ ప్రైవేట్‌గా సేవ్ అవుతుంది.', firebaseMissing: 'సైన్-ఇన్ ఇంకా సెటప్ కాలేదు. Firebase వెబ్ యాప్ వివరాలను జోడించండి.', email: 'ఇమెయిల్ చిరునామా', password: 'పాస్‌వర్డ్', signIn: 'సైన్ ఇన్', createAccount: 'ఖాతా సృష్టించండి', forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?', haveAccount: 'ఖాతా ఉందా? సైన్ ఇన్ చేయండి', needAccount: 'కొత్తవారా? ఖాతా సృష్టించండి', backToSignIn: 'సైన్ ఇన్‌కు తిరిగి వెళ్లండి', sendReset: 'రీసెట్ లింక్ పంపండి', resetSent: 'పాస్‌వర్డ్ రీసెట్ ఇమెయిల్ పంపబడింది.', working: 'దయచేసి వేచి ఉండండి…', signInError: 'ఇమెయిల్ లేదా పాస్‌వర్డ్ తప్పు.', emailInUse: 'ఈ ఇమెయిల్‌తో ఇప్పటికే ఖాతా ఉంది.', weakPassword: 'కనీసం 6 అక్షరాల పాస్‌వర్డ్ వాడండి.', invalidEmail: 'సరైన ఇమెయిల్ చిరునామా నమోదు చేయండి.', tryLater: 'చాలా ప్రయత్నాలు. తర్వాత మళ్లీ ప్రయత్నించండి.', authError: 'సైన్ ఇన్ కాలేదు. ఇంటర్నెట్ తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.', storageConsent: 'తదుపరి ప్రయాణాల కోసం ఎన్‌క్రిప్ట్ చేసిన పాస్‌పోర్ట్ కాపీని సేవ్ చేయండి. గడువు ముగిసిన 30 రోజులకు లేదా కొత్తది జోడించినప్పుడు తొలగిస్తాం.', passportNotStored: 'పాస్‌పోర్ట్ వివరాలు ఈ తనిఖీకి మాత్రమే; ప్రొఫైల్‌లో సేవ్ కావు.', passportStored: 'ఎన్‌క్రిప్ట్ చేసిన పాస్‌పోర్ట్ కాపీ సేవ్ అయింది', removePassport: 'సేవ్ చేసిన పాస్‌పోర్ట్ తొలగించండి', account: 'సైన్ ఇన్ అయ్యారు', signOut: 'సైన్ అవుట్', deleteData: 'నా సేవ్ చేసిన డేటా తొలగించండి', deleteConfirm: 'సేవ్ చేసిన ప్రయాణ చరిత్ర, పాస్‌పోర్ట్ ఫైళ్లన్నీ తొలగించాలా? తిరిగి పొందలేరు.', deleteFailed: 'సేవ్ చేసిన డేటా తొలగించలేకపోయాం. మళ్లీ ప్రయత్నించండి.', saving: 'భద్రంగా సేవ్ చేస్తోంది…', saved: 'భద్రంగా సేవ్ అయింది', saveFailed: 'సేవ్ కాలేదు. ఇంటర్నెట్ తనిఖీ చేయండి.', tripHistory: 'ఇటీవలి ప్రయాణాలు', loadTrip: 'తెరవండి', flightStatus: 'విమాన స్థితి', statusHelp: 'ప్రతి ప్రత్యక్ష తనిఖీ నెలకు 100 ఉచిత అభ్యర్థనల్లో ఒకటి. హెచ్చరికలకు హామీ లేదు.', checkStatus: 'స్థితి తనిఖీ', statusLoading: 'తనిఖీ చేస్తోంది…', statusUnavailable: 'విమాన స్థితి అందుబాటులో లేదు.', statusChecked: 'తనిఖీ సమయం', statusCancelled: 'రద్దు', statusScheduled: 'షెడ్యూల్‌లో ఉంది', statusActive: 'విమానంలో ఉంది', statusLanded: 'దిగింది', statusDiverted: 'దారి మళ్లింది', statusUnknown: 'తెలియదు', noFlight: 'ముందుగా టికెట్ విమాన నంబర్, తేదీ జోడించండి.', statusDelay: 'ఆలస్యం', statusGate: 'గేట్', statusTerminal: 'టెర్మినల్', statusFailed: 'విమాన స్థితిని తనిఖీ చేయలేకపోయాం.',
  },
}
const privacyCopy = {
  en: { accountPrivacy: 'Your profile is encrypted before it is saved. Uploaded documents are processed by Gemini on Vertex AI. Passport files are retained privately only with your consent.', passportReupload: 'You allowed storage after this passport was read. Upload it again to save the encrypted original.', quotaReached: 'The free flight-status check limit has been reached for this month.', statusNotFound: 'No live status was found for that flight and date.' },
  hi: { accountPrivacy: 'प्रोफ़ाइल सेव करने से पहले एन्क्रिप्ट होती है। दस्तावेज़ Gemini on Vertex AI से पढ़े जाते हैं। पासपोर्ट फ़ाइल आपकी अनुमति पर ही निजी रूप से रखी जाती है।', passportReupload: 'यह पासपोर्ट पढ़ने के बाद आपने सेव करने की अनुमति दी। एन्क्रिप्टेड प्रति सेव करने के लिए इसे फिर अपलोड करें।', quotaReached: 'इस महीने की मुफ़्त उड़ान-जाँच सीमा पूरी हो गई है।', statusNotFound: 'इस उड़ान और तारीख़ की लाइव जानकारी नहीं मिली।' },
  ta: { accountPrivacy: 'சுயவிவரம் சேமிப்பதற்கு முன் குறியாக்கம் செய்யப்படும். ஆவணங்கள் Vertex AI Gemini மூலம் படிக்கப்படும். உங்கள் அனுமதியுடன் மட்டுமே பாஸ்போர்ட் தனிப்பட்ட முறையில் வைக்கப்படும்.', passportReupload: 'இந்த பாஸ்போர்ட் படிக்கப்பட்ட பிறகு சேமிக்க அனுமதித்துள்ளீர்கள். குறியாக்கப்பட்ட அசலைச் சேமிக்க மீண்டும் பதிவேற்றுங்கள்.', quotaReached: 'இந்த மாதத்திற்கான இலவச விமானச் சரிபார்ப்பு வரம்பு முடிந்தது.', statusNotFound: 'அந்த விமானம், தேதிக்கான நேரடி நிலை கிடைக்கவில்லை.' },
  te: { accountPrivacy: 'ప్రొఫైల్ సేవ్ చేసే ముందు ఎన్‌క్రిప్ట్ అవుతుంది. పత్రాలు Vertex AI Gemini ద్వారా చదవబడతాయి. మీ అనుమతితో మాత్రమే పాస్‌పోర్ట్ ప్రైవేట్‌గా ఉంచబడుతుంది.', passportReupload: 'ఈ పాస్‌పోర్ట్ చదివిన తర్వాత నిల్వకు మీరు అనుమతి ఇచ్చారు. ఎన్‌క్రిప్ట్ చేసిన అసలును సేవ్ చేయడానికి మళ్లీ అప్‌లోడ్ చేయండి.', quotaReached: 'ఈ నెల ఉచిత విమాన స్థితి తనిఖీ పరిమితి పూర్తయింది.', statusNotFound: 'ఆ విమానం, తేదీకి ప్రత్యక్ష స్థితి దొరకలేదు.' },
}
const flightLimitCopy = {
  en: { statusHelp: 'Up to 10 checks per account, within the app-wide 100 free monthly requests. Manual checks only; alerts are not guaranteed.' },
  hi: { statusHelp: 'हर खाते में 10 जाँच तक, ऐप की कुल 100 मुफ़्त मासिक जाँचों में से। जाँच खुद करें; अलर्ट की गारंटी नहीं है।' },
  ta: { statusHelp: 'ஒரு கணக்கிற்கு 10 சரிபார்ப்புகள் வரை; செயலி முழுவதும் மாதம் 100 இலவச கோரிக்கைகள். கைமுறைச் சரிபார்ப்பு மட்டுமே; அறிவிப்பு உறுதியில்லை.' },
  te: { statusHelp: 'ఒక్కో ఖాతాకు 10 తనిఖీల వరకు; యాప్ మొత్తానికి నెలకు 100 ఉచిత అభ్యర్థనలు. మాన్యువల్ తనిఖీలు మాత్రమే; హెచ్చరికలకు హామీ లేదు.' },
}
const featureCopy = {
  en: { emergencyTitle: 'Emergency contact', emergencyHelp: 'Add someone we can contact if you need help. This is encrypted and saved as soon as you press Save.', emergencyName: 'Contact name', emergencyPhone: 'Phone number with country code', emergencyRelation: 'Relationship (optional)', saveContact: 'Save emergency contact', clearContact: 'Clear contact', contactSaved: 'Emergency contact saved securely.', contactError: 'Emergency contact could not be saved.', assistantTitle: 'Ask MyFirstFlight', assistantHelp: 'Type a question or record a short voice question. Answers are shown in your language and English.', askPlaceholder: 'For example: Where do I go after check-in?', askSend: 'Ask', micStart: 'Record a question', micStop: 'Stop recording', transcribing: 'Listening…', thinking: 'Preparing an answer…', replyTitle: 'Answer', englishAnswer: 'English', localAnswer: 'Your language', readAnswer: 'Read answer aloud', speechUnavailable: 'Voice recording is not supported in this browser. Try Chrome on Android or enter your question.', micPermission: 'Allow microphone access to record your question.', noTranscript: 'No speech was recognized. Please try again slowly.', askFailed: 'The answer could not be prepared. Try again.', speakFailed: 'Audio could not be played. Try again.', translationUnavailable: 'This language could not be loaded. Showing English for now.' },
  hi: { emergencyTitle: 'आपातकालीन संपर्क', emergencyHelp: 'ज़रूरत पड़ने पर मदद के लिए किसी का संपर्क जोड़ें। सेव दबाते ही यह एन्क्रिप्ट होकर सेव होगा।', emergencyName: 'संपर्क का नाम', emergencyPhone: 'देश कोड सहित फ़ोन नंबर', emergencyRelation: 'रिश्ता (ज़रूरी नहीं)', saveContact: 'आपातकालीन संपर्क सेव करें', clearContact: 'संपर्क मिटाएँ', contactSaved: 'आपातकालीन संपर्क सुरक्षित रूप से सेव है।', contactError: 'आपातकालीन संपर्क सेव नहीं हो सका।', assistantTitle: 'MyFirstFlight से पूछें', assistantHelp: 'सवाल लिखें या आवाज़ में छोटा सवाल रिकॉर्ड करें। जवाब आपकी भाषा और अंग्रेज़ी में दिखेगा।', askPlaceholder: 'उदाहरण: चेक-इन के बाद कहाँ जाना है?', askSend: 'पूछें', micStart: 'सवाल रिकॉर्ड करें', micStop: 'रिकॉर्डिंग रोकें', transcribing: 'सुन रहे हैं…', thinking: 'जवाब तैयार हो रहा है…', replyTitle: 'जवाब', englishAnswer: 'अंग्रेज़ी', localAnswer: 'आपकी भाषा', readAnswer: 'जवाब सुनें', speechUnavailable: 'इस ब्राउज़र में आवाज़ रिकॉर्ड नहीं हो सकती। Android पर Chrome आज़माएँ या सवाल लिखें।', micPermission: 'सवाल रिकॉर्ड करने के लिए माइक्रोफ़ोन की अनुमति दें।', noTranscript: 'आवाज़ समझ नहीं आई। धीरे बोलकर फिर कोशिश करें।', askFailed: 'जवाब नहीं मिल सका। फिर कोशिश करें।', speakFailed: 'आवाज़ नहीं चल सकी। फिर कोशिश करें।', translationUnavailable: 'यह भाषा अभी लोड नहीं हुई। फिलहाल अंग्रेज़ी दिखाई जा रही है।' },
  ta: { emergencyTitle: 'அவசரத் தொடர்பு', emergencyHelp: 'உதவி தேவைப்பட்டால் தொடர்புகொள்ள ஒருவரைச் சேர்க்கவும். சேமி என்பதை அழுத்தியதும் குறியாக்கப்பட்டு சேமிக்கப்படும்.', emergencyName: 'தொடர்பு பெயர்', emergencyPhone: 'நாட்டுக் குறியீட்டுடன் தொலைபேசி எண்', emergencyRelation: 'உறவு (விருப்பம்)', saveContact: 'அவசரத் தொடர்பைச் சேமி', clearContact: 'தொடர்பை அழி', contactSaved: 'அவசரத் தொடர்பு பாதுகாப்பாகச் சேமிக்கப்பட்டது.', contactError: 'அவசரத் தொடர்பைச் சேமிக்க முடியவில்லை.', assistantTitle: 'MyFirstFlight-ஐ கேளுங்கள்', assistantHelp: 'கேள்வியைத் தட்டச்சு செய்யவும் அல்லது குரலில் பதிவு செய்யவும். பதில் உங்கள் மொழியிலும் ஆங்கிலத்திலும் வரும்.', askPlaceholder: 'எடுத்துக்காட்டு: செக்-இனுக்குப் பிறகு எங்கே செல்ல வேண்டும்?', askSend: 'கேள்', micStart: 'கேள்வியைப் பதிவு செய்', micStop: 'பதிவை நிறுத்து', transcribing: 'கேட்கிறது…', thinking: 'பதில் தயாராகிறது…', replyTitle: 'பதில்', englishAnswer: 'ஆங்கிலம்', localAnswer: 'உங்கள் மொழி', readAnswer: 'பதிலை ஒலியாகக் கேள்', speechUnavailable: 'இந்த உலாவியில் குரல் பதிவு ஆதரிக்கப்படவில்லை. Android Chrome முயற்சிக்கவும் அல்லது தட்டச்சு செய்யவும்.', micPermission: 'கேள்வியைப் பதிவு செய்ய மைக்ரோஃபோன் அனுமதி அளிக்கவும்.', noTranscript: 'பேச்சைப் புரிந்துகொள்ள முடியவில்லை. மெதுவாக மீண்டும் முயற்சிக்கவும்.', askFailed: 'பதில் கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.', speakFailed: 'ஒலியை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  te: { emergencyTitle: 'అత్యవసర సంప్రదింపు', emergencyHelp: 'సహాయం అవసరమైతే సంప్రదించడానికి ఒకరిని జోడించండి. సేవ్ నొక్కగానే ఎన్‌క్రిప్ట్ చేసి నిల్వ చేస్తాం.', emergencyName: 'సంప్రదింపు పేరు', emergencyPhone: 'దేశ కోడ్‌తో ఫోన్ నంబర్', emergencyRelation: 'సంబంధం (ఐచ్ఛికం)', saveContact: 'అత్యవసర సంప్రదింపును సేవ్ చేయండి', clearContact: 'సంప్రదింపును తొలగించండి', contactSaved: 'అత్యవసర సంప్రదింపు భద్రంగా సేవ్ అయింది.', contactError: 'అత్యవసర సంప్రదింపును సేవ్ చేయలేకపోయాం.', assistantTitle: 'MyFirstFlight‌ను అడగండి', assistantHelp: 'ప్రశ్న టైప్ చేయండి లేదా చిన్న వాయిస్ ప్రశ్న రికార్డ్ చేయండి. సమాధానం మీ భాషలో, ఇంగ్లీష్‌లో కనిపిస్తుంది.', askPlaceholder: 'ఉదాహరణ: చెక్-ఇన్ తర్వాత ఎక్కడికి వెళ్లాలి?', askSend: 'అడగండి', micStart: 'ప్రశ్న రికార్డ్ చేయండి', micStop: 'రికార్డింగ్ ఆపండి', transcribing: 'వింటోంది…', thinking: 'సమాధానం సిద్ధమవుతోంది…', replyTitle: 'సమాధానం', englishAnswer: 'ఇంగ్లీష్', localAnswer: 'మీ భాష', readAnswer: 'సమాధానం వినండి', speechUnavailable: 'ఈ బ్రౌజర్‌లో వాయిస్ రికార్డింగ్ లేదు. Android Chrome ప్రయత్నించండి లేదా టైప్ చేయండి.', micPermission: 'ప్రశ్న రికార్డ్ చేయడానికి మైక్రోఫోన్ అనుమతి ఇవ్వండి.', noTranscript: 'మాట అర్థం కాలేదు. నెమ్మదిగా మళ్లీ ప్రయత్నించండి.', askFailed: 'సమాధానం రాలేదు. మళ్లీ ప్రయత్నించండి.', speakFailed: 'ఆడియో వినిపించలేదు. మళ్లీ ప్రయత్నించండి.' },
}
const emergencyCopy = {
  en: { contactCleared: 'Emergency contact deleted.' },
  hi: { contactCleared: 'आपातकालीन संपर्क हटा दिया गया।' },
  ta: { contactCleared: 'அவசரத் தொடர்பு நீக்கப்பட்டது.' },
  te: { contactCleared: 'అత్యవసర సంప్రదింపు తొలగించబడింది.' },
}
const englishUiCopy = { ...copy.en, ...accountCopy.en, ...privacyCopy.en, ...flightLimitCopy.en, ...featureCopy.en, ...emergencyCopy.en }
const serviceErrors = {
  en: 'The document reader is unavailable. Please contact the person who set up this app.',
  hi: 'दस्तावेज़ पढ़ने की सुविधा उपलब्ध नहीं है। कृपया इस ऐप को सेट करने वाले व्यक्ति से संपर्क करें।',
  ta: 'ஆவண வாசிப்பு வசதி கிடைக்கவில்லை. இந்தச் செயலியை அமைத்தவரைத் தொடர்பு கொள்ளுங்கள்.',
  te: 'పత్రాలను చదివే సదుపాయం అందుబాటులో లేదు. ఈ యాప్‌ను ఏర్పాటు చేసిన వ్యక్తిని సంప్రదించండి.',
}

const documents = [
  { key: 'ticket', icon: '✈', hintKey: 'ticketHint' },
  { key: 'passport', icon: '▤', hintKey: 'passportHint' },
  { key: 'visa', icon: '▣', hintKey: 'visaHint' },
]

const newTraveller = () => ({ id: crypto.randomUUID(), name: '', assistance: '', files: {}, extracted: {}, busy: {}, error: {}, passportConsent: false, passportStored: false })
const getSavedLanguage = () => {
  try { return basicLanguageCodes.includes(localStorage.getItem('mff-language')) ? localStorage.getItem('mff-language') : 'en' }
  catch { return 'en' }
}

function App() {
  const [language, setLanguage] = useState(getSavedLanguage)
  const [travellers, setTravellers] = useState([newTraveller()])
  const [trip, setTrip] = useState({ origin: '', destination: '', departureDate: '', returnDate: '', airline: '', flightNumber: '', booking: '', baggage: '' })
  const [tripHistory, setTripHistory] = useState([])
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [staffPhrase, setStaffPhrase] = useState(null)
  const [authUser, setAuthUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileState, setProfileState] = useState('idle')
  const [profileRetry, setProfileRetry] = useState(0)
  const [saveState, setSaveState] = useState('')
  const [flightStatus, setFlightStatus] = useState(null)
  const [checkingFlight, setCheckingFlight] = useState(false)
  const [flightError, setFlightError] = useState('')
  const [translatedCopies, setTranslatedCopies] = useState({})
  const [translationFailed, setTranslationFailed] = useState(false)
  const text = { ...copy.en, ...accountCopy.en, ...privacyCopy.en, ...flightLimitCopy.en, ...featureCopy.en, ...emergencyCopy.en, ...copy[language], ...accountCopy[language], ...privacyCopy[language], ...flightLimitCopy[language], ...featureCopy[language], ...emergencyCopy[language], ...translatedCopies[language] }

  useEffect(() => {
    if (basicLanguageCodes.includes(language)) {
      setTranslationFailed(false)
      return undefined
    }
    let active = true
    const cacheKey = `mff-ui-copy-${language}-v1`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setTranslatedCopies((current) => ({ ...current, [language]: JSON.parse(cached) }))
        setTranslationFailed(false)
        return undefined
      }
    } catch { /* Translation will be requested again if the cache is unavailable. */ }
    if (!authUser) return undefined
    setTranslationFailed(false)
    const keys = Object.keys(englishUiCopy)
    authUser.getIdToken().then((token) => fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_language: 'en', target_language: language, texts: keys.map((key) => englishUiCopy[key]) }),
    })).then(async (response) => {
      if (!response.ok) throw new Error('translation unavailable')
      const result = await response.json()
      const translated = Object.fromEntries(keys.map((key, index) => [key, result.translations[index] || englishUiCopy[key]]))
      if (active) {
        setTranslatedCopies((current) => ({ ...current, [language]: translated }))
        setTranslationFailed(false)
        try { localStorage.setItem(cacheKey, JSON.stringify(translated)) } catch { /* Keep translated labels in memory. */ }
      }
    }).catch(() => { if (active) setTranslationFailed(true) })
    return () => { active = false }
  }, [authUser, language])

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true)
      return undefined
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser)
      if (!nextUser) setLanguage((current) => {
        const nextLanguage = basicLanguageCodes.includes(current) ? current : 'en'
        try { localStorage.setItem('mff-language', nextLanguage) } catch { /* Keep a supported sign-in language for this session. */ }
        return nextLanguage
      })
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!authUser) {
      setProfileState('idle')
      return undefined
    }
    let active = true
    setProfileState('loading')
    authUser.getIdToken().then((token) => fetch(`${API_BASE_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })).then(async (response) => {
      if (!response.ok) throw new Error(text.saveFailed)
      const profile = await response.json()
      if (!active) return
      if (profile.language && languages.some(({ code }) => code === profile.language)) {
        setLanguage(profile.language)
        try { localStorage.setItem('mff-language', profile.language) } catch { /* Keep the profile language for this session. */ }
      }
      if (profile.trip) setTrip((current) => ({ ...current, ...profile.trip }))
      if (Array.isArray(profile.travellers) && profile.travellers.length) setTravellers(profile.travellers.map((traveller) => ({ ...newTraveller(), ...traveller, files: {}, busy: {}, error: {}, passportConsent: Boolean(traveller.passport_consent), passportStored: Boolean(traveller.passport_stored) })))
      if (Array.isArray(profile.trip_history)) setTripHistory(profile.trip_history)
      setProfileState('ready')
    }).catch(() => { if (active) setProfileState('error') })
    return () => { active = false }
  }, [authUser, profileRetry])

  useEffect(() => {
    if (!authUser || profileState !== 'ready') return undefined
    if (travellers.some((traveller) => Object.values(traveller.busy).some(Boolean))) return undefined
    let active = true
    const timer = setTimeout(async () => {
      setSaveState('saving')
      try {
        const token = await authUser.getIdToken()
        const payload = {
          language,
          trip,
          trip_history: tripHistory,
          travellers: travellers.map(({ id, name, assistance, extracted, passportConsent, passportStored }) => {
            const savedExtracted = { ...extracted }
            if (!passportConsent || !passportStored) delete savedExtracted.passport
            return { id, name, assistance, extracted: savedExtracted, passport_consent: passportConsent, passport_stored: passportStored }
          }),
        }
        const response = await fetch(`${API_BASE_URL}/api/profile`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!response.ok) throw new Error('save failed')
        if (active) setSaveState('saved')
      } catch {
        if (active) setSaveState('error')
      }
    }, 900)
    return () => { active = false; clearTimeout(timer) }
  }, [authUser, profileState, language, trip, travellers, tripHistory])

  useEffect(() => {
    if (!trip.flightNumber || !trip.departureDate) return
    const key = trip.booking || `${trip.flightNumber}-${trip.departureDate}`
    const snapshot = { ...trip, id: key }
    setTripHistory((history) => [snapshot, ...history.filter((item) => item.id !== key)].slice(0, 10))
  }, [trip.flightNumber, trip.departureDate, trip.booking, trip.origin, trip.destination])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const changeLanguage = (code) => {
    setLanguage(code)
    try { localStorage.setItem('mff-language', code) } catch { /* Keep the selection for this session. */ }
  }

  const updateTraveller = (id, update) => {
    setValidation(null)
    setTravellers((items) => items.map((traveller) => traveller.id === id ? { ...traveller, ...update } : traveller))
  }

  const setTripValue = (key, value) => {
    setValidation(null)
    setTrip((current) => ({ ...current, [key]: value }))
  }

  const uploadDocument = async (traveller, kind, file) => {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type) && !['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      updateTraveller(traveller.id, { error: { ...traveller.error, [kind]: text.unsupported } })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      updateTraveller(traveller.id, { error: { ...traveller.error, [kind]: text.tooLarge } })
      return
    }
    const files = { ...traveller.files, [kind]: file }
    const extracted = { ...traveller.extracted }
    if (kind !== 'passport' || !traveller.passportStored) delete extracted[kind]
    updateTraveller(traveller.id, { files, extracted, busy: { ...traveller.busy, [kind]: true }, error: { ...traveller.error, [kind]: '' } })
    const form = new FormData()
    form.append('file', file)
    form.append('document_type', kind)
    form.append('traveller_id', traveller.id)
    form.append('store_passport_consent', String(kind === 'passport' && traveller.passportConsent))
    try {
      const token = await authUser.getIdToken()
      const response = await fetch(`${API_BASE_URL}/api/extract-document`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(response.status >= 500 ? serviceErrors[language] : text.uploadError)
      const extracted = data.extracted
      setTravellers((items) => items.map((item) => item.id === traveller.id ? { ...item, files, extracted: { ...item.extracted, [kind]: extracted }, passportStored: kind === 'passport' ? Boolean(data.passport_stored) : item.passportStored, busy: { ...item.busy, [kind]: false }, error: { ...item.error, [kind]: '' } } : item))
      if (kind === 'ticket') {
        const first = extracted.segments?.[0] || {}
        const second = extracted.segments?.[1] || {}
        const isReturn = second.origin && first.destination && second.origin.toLowerCase() === first.destination.toLowerCase()
        setTrip((current) => ({ ...current, origin: first.origin || current.origin, destination: first.destination || current.destination, departureDate: first.departure_date?.slice(0, 10) || current.departureDate, returnDate: isReturn ? second.departure_date?.slice(0, 10) || current.returnDate : current.returnDate, airline: extracted.airline || current.airline, flightNumber: first.flight_number || current.flightNumber, booking: extracted.pnr || current.booking, baggage: extracted.baggage_allowance || current.baggage }))
      }
      setValidation(null)
    } catch (error) {
      const message = error instanceof TypeError ? text.uploadError : error.message
      setTravellers((items) => items.map((item) => item.id === traveller.id ? { ...item, files, busy: { ...item.busy, [kind]: false }, error: { ...item.error, [kind]: message } } : item))
    }
  }

  const runValidation = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate-trip`, {
        method: 'POST', headers: { Authorization: `Bearer ${await authUser.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: trip.origin, destination: trip.destination, departure_date: trip.departureDate, return_date: trip.returnDate || null, travellers: travellers.map(({ name, assistance, extracted }) => ({ name, assistance, documents: extracted })) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(text.failed)
      setValidation(data)
    } catch (error) {
      setValidation({ error: error.message })
    } finally { setValidating(false) }
  }

  const checkFlight = async () => {
    if (!trip.flightNumber || !trip.departureDate) {
      setFlightError(text.noFlight)
      return
    }
    setCheckingFlight(true)
    setFlightError('')
    try {
      const token = await authUser.getIdToken()
      const response = await fetch(`${API_BASE_URL}/api/flight-status`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ flight_iata: trip.flightNumber, flight_date: trip.departureDate }) })
      const result = await response.json()
      if (!response.ok) throw new Error(response.status === 429 ? text.quotaReached : response.status === 404 ? text.statusNotFound : text.statusFailed)
      setFlightStatus(result)
    } catch (error) {
      setFlightError(error.message || text.statusFailed)
    } finally {
      setCheckingFlight(false)
    }
  }

  const removePassport = async (traveller) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/passports/${traveller.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await authUser.getIdToken()}` } })
      if (!response.ok) throw new Error()
      const extracted = { ...traveller.extracted }
      delete extracted.passport
      updateTraveller(traveller.id, { passportConsent: false, passportStored: false, extracted })
    } catch {
      setSaveState('error')
    }
  }

  const eraseAccountData = async () => {
    if (!window.confirm(text.deleteConfirm)) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile`, { method: 'DELETE', headers: { Authorization: `Bearer ${await authUser.getIdToken()}` } })
      if (!response.ok) throw new Error()
      await signOut(auth)
    } catch {
      setSaveState('error')
    }
  }

  const readyToValidate = travellers.every((person) => ['ticket', 'passport', 'visa'].every((kind) => person.extracted[kind]) && !Object.values(person.busy).some(Boolean)) && trip.origin && trip.destination && trip.departureDate
  const localizeCheck = (check) => {
    const index = Number(check.title.match(/Traveller (\d+)/)?.[1] || 1)
    const category = check.title.toLowerCase()
    const key = category.includes('missing') ? 'checkMissing' : category.includes('name') ? 'checkNames' : category.includes('passport') ? 'checkPassport' : 'checkVisa'
    const messageKey = category.includes('missing') ? 'checkMissingMessage' : category.includes('name') ? 'checkNamesMessage' : category.includes('passport') ? 'checkPassportMessage' : 'checkVisaMessage'
    return { ...check, title: `${text.traveller} ${index}: ${text[key]}`, message: check.status === 'pass' ? text.readyTitle : text[messageKey] }
  }

  if (!authReady) return <main className="auth-shell"><section className="auth-panel">{text.working}</section></main>
  if (!authUser) return <AuthGate text={text} language={language} languages={languages.filter(({ code }) => basicLanguageCodes.includes(code))} onLanguageChange={changeLanguage} />
  if (profileState === 'loading' || profileState === 'idle') return <main className="auth-shell"><section className="auth-panel">{text.working}</section></main>
  if (profileState === 'error') return <main className="auth-shell"><section className="auth-panel"><h1>{text.saveFailed}</h1><p>{text.accountIntro}</p><button className="review-button" onClick={() => setProfileRetry((value) => value + 1)}>{text.checkStatus}</button><button className="auth-link" onClick={() => signOut(auth)}>{text.signOut}</button></section></main>

  return (
    <main className="page-shell">
      <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">✈</span><span>FirstFlight<span className="brand-ai"> AI</span></span></a><div className="account-controls"><span>{authUser.email}</span><span className={`save-indicator ${saveState === 'error' ? 'error' : ''}`}>{saveState === 'saving' ? text.saving : saveState === 'saved' ? text.saved : saveState === 'error' ? text.saveFailed : ''}</span><button onClick={() => signOut(auth)}>{text.signOut}</button></div></header>
      <section className="intro" id="top"><div className="eyebrow"><span /> {text.eyebrow}</div><h1>{text.title}<br /><em>{text.titleAccent}</em></h1><p>{text.intro}</p></section>
      {!basicLanguageCodes.includes(language) && !translatedCopies[language] && <p className="translation-status" role="status">{translationFailed ? text.translationUnavailable : text.translationLoading}</p>}
      <div className="stepper" aria-label={text.reviewStep}><div className="step active"><span>01</span><b>{text.languageStep}</b></div><div className="step-line" /><div className="step active"><span>02</span><b>{text.travellersStep}</b></div><div className="step-line" /><div className={`step ${validation ? 'active' : ''}`}><span>03</span><b>{text.reviewStep}</b></div></div>

      <section className="section-card language-card"><div className="section-heading"><div><div className="section-kicker">01</div><h2>{text.chooseLanguage}</h2><p>{text.languageHelp}</p></div><span className="heading-icon">文</span></div><div className="language-grid" role="group" aria-label={text.chooseLanguage}>{languages.map(({ code, label }) => <button key={code} type="button" lang={code} aria-pressed={language === code} className={`language-option ${language === code ? 'selected' : ''}`} onClick={() => changeLanguage(code)}>{label}{language === code && <span>✓</span>}</button>)}</div></section>

      <EmergencyContact apiBaseUrl={API_BASE_URL} user={authUser} text={text} language={language} />

      <div className="traveller-header"><div><div className="section-kicker">02</div><h2>{text.travellers}</h2><p>{text.travellerHelp}</p></div><button className="add-button" onClick={() => { setTravellers((items) => [...items, newTraveller()]); setValidation(null) }}><span>＋</span> {text.addTraveller}</button></div>

      <div className="traveller-list">{travellers.map((person, index) => <article className="traveller-card" key={person.id}><div className="traveller-title"><div className="traveller-avatar">{String(index + 1).padStart(2, '0')}</div><div><h3>{text.traveller} {index + 1}</h3><span>{text.passengerDetails}</span></div>{travellers.length > 1 && <button className="remove-button" aria-label={`${text.remove} ${text.traveller} ${index + 1}`} onClick={() => { setTravellers((items) => items.filter((item) => item.id !== person.id)); setValidation(null) }}>{text.remove}</button>}</div>
        <label className="field-label">{text.name}<span>{text.nameHint}</span><input className="text-field" placeholder={text.namePlaceholder} value={person.name} onChange={(event) => updateTraveller(person.id, { name: event.target.value })} /></label>
        <div className="upload-heading"><div><h4>{text.documents}</h4><p>{text.documentsHelp}</p></div><span className="secure-note">⌑</span></div>
        <div className="document-grid">{documents.map((doc) => <label className={`document-upload ${person.extracted[doc.key] ? 'uploaded' : ''}`} key={doc.key}><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => uploadDocument(person, doc.key, event.target.files?.[0])} /><span className="document-icon">{doc.icon}</span><span className="document-title">{text[doc.key]}</span><span className="document-hint">{text[doc.hintKey]}</span><span className="upload-action">{person.busy[doc.key] ? text.reading : person.extracted[doc.key] ? `✓ ${text.extracted}` : `＋ ${text.chooseFile}`}</span>{person.files[doc.key] && <span className="file-name">{person.files[doc.key].name}</span>}{person.error[doc.key] && <span className="upload-error">{person.error[doc.key]}</span>}</label>)}</div>
        <label className="passport-consent"><input type="checkbox" checked={Boolean(person.passportConsent)} onChange={(event) => { if (!event.target.checked && person.passportStored) removePassport(person); else updateTraveller(person.id, { passportConsent: event.target.checked }) }} /><span>{text.storageConsent}</span></label>
        {person.passportStored && <div className="passport-saved"><span>{text.passportStored}</span><button type="button" onClick={() => removePassport(person)}>{text.removePassport}</button></div>}
        {!person.passportConsent && !person.passportStored && <p className="field-note">{text.passportNotStored}</p>}
        {person.passportConsent && person.extracted.passport && !person.passportStored && <p className="field-note">{text.passportReupload}</p>}
        <label className="field-label assistance-label">{text.needHelp}<span>{text.optional}</span><select className="text-field" value={person.assistance} onChange={(event) => updateTraveller(person.id, { assistance: event.target.value })}><option value="">{text.noAssistance}</option><option value="wheelchair">{text.wheelchair}</option><option value="mobility">{text.mobility}</option><option value="visual">{text.visual}</option><option value="elderly">{text.elderly}</option><option value="other">{text.other}</option></select></label>
      </article>)}</div>

      <section className="section-card trip-card"><div className="section-heading"><div><h2>{text.tripTitle}</h2><p>{text.tripHelp}</p></div><span className="heading-icon">✈</span></div><div className="trip-fields"><label className="field-label">{text.origin}<input className="text-field" value={trip.origin} onChange={(event) => setTripValue('origin', event.target.value)} /></label><label className="field-label">{text.destination}<input className="text-field" value={trip.destination} onChange={(event) => setTripValue('destination', event.target.value)} /></label><label className="field-label">{text.departureDate}<input className="text-field" type="date" value={trip.departureDate} onChange={(event) => setTripValue('departureDate', event.target.value)} /></label><label className="field-label">{text.returnDate}<span>{text.returnHint}</span><input className="text-field" type="date" value={trip.returnDate} onChange={(event) => setTripValue('returnDate', event.target.value)} /></label></div><div className="trip-fields flight-summary">{[['airline', text.airline], ['flightNumber', text.flightNumber], ['booking', text.booking], ['baggage', text.baggage]].map(([key, label]) => <div className="field-label" key={key}>{label}<b>{trip[key] || text.notOnTicket}</b></div>)}</div><div className="flight-check"><div><h3>{text.flightStatus}</h3><p>{text.statusHelp}</p></div><button type="button" className="btn sec" onClick={checkFlight} disabled={checkingFlight}>{checkingFlight ? text.statusLoading : text.checkStatus}</button>{flightError && <p className="upload-error">{flightError}</p>}{flightStatus && <div className={`flight-result ${flightStatus.cancelled ? 'cancelled' : ''}`}><strong>{text[`status${flightStatus.status[0].toUpperCase()}${flightStatus.status.slice(1)}`] || text.statusUnknown}</strong><span>{text.statusChecked}: {new Date(flightStatus.checked_at).toLocaleString(language)}</span>{flightStatus.departure_delay_minutes > 0 && <span>{text.statusDelay}: {flightStatus.departure_delay_minutes} min</span>}{flightStatus.departure_gate && <span>{text.statusGate}: {flightStatus.departure_gate}</span>}{flightStatus.departure_terminal && <span>{text.statusTerminal}: {flightStatus.departure_terminal}</span>}</div>}</div></section>

      <TravelAssistant apiBaseUrl={API_BASE_URL} user={authUser} language={language} text={text} />

      {tripHistory.length > 0 && <section className="section-card history-card"><div className="section-heading"><div><h2>{text.tripHistory}</h2></div></div><div className="history-list">{tripHistory.map((item) => <div className="history-row" key={item.id}><span><b>{item.flightNumber || item.booking}</b><small>{item.origin} → {item.destination} · {item.departureDate}</small></span><button type="button" onClick={() => setTrip((current) => ({ ...current, ...item }))}>{text.loadTrip}</button></div>)}</div></section>}

      <section className="review-area"><div><div className="section-kicker">03</div><h2>{text.checkTitle}</h2><p>{text.checkHelp}</p>{!readyToValidate && <p className="review-hint">{text.needDocs}</p>}</div><button className="review-button" onClick={runValidation} disabled={!readyToValidate || validating}>{validating ? <><span className="spinner" /> {text.checking}</> : <>{text.checkButton} <span>→</span></>}</button></section>
      {validation && <section className={`result-card ${validation.error || validation.status === 'review' ? 'needs-review' : ''}`}><div className="result-icon">{validation.error ? '!' : validation.status === 'ready' ? '✓' : '!'}</div><div className="result-content"><div className="section-kicker">{text.resultTitle}</div><h2>{validation.error ? text.failed : validation.status === 'ready' ? text.readyTitle : text.reviewTitle}</h2>{validation.error ? <p>{validation.error}</p> : <><p>{text.automated}</p><ul>{validation.checks?.map((check, i) => { const localized = localizeCheck(check); return <li key={i}><span className={check.status === 'pass' ? 'check-pass' : 'check-warn'}>{check.status === 'pass' ? '✓' : '!'}</span><span><b>{localized.title}</b>{localized.message && <small>{localized.message}</small>}</span></li> })}</ul></>}</div></section>}
      <section className="section-card staff-card"><div className="section-heading"><div><h2>{text.helpTitle}</h2><p>{text.helpText}</p></div><span className="heading-icon">?</span></div><div className="staff-phrases">{[['askDirections', 'Please show us where to go for our flight.'], ['needWheelchair', 'We need wheelchair assistance, please.'], ['speakSlowly', 'We are travelling for the first time. Please speak slowly and help us.']].map(([key, english]) => <button type="button" key={key} onClick={() => setStaffPhrase(staffPhrase === key ? null : key)}><span>{english}</span><small lang={language}>{text[key]}</small></button>)}</div>{staffPhrase && <div className="staff-display" role="status"><b>{text.showStaff}</b><span>{[['askDirections', 'Please show us where to go for our flight.'], ['needWheelchair', 'We need wheelchair assistance, please.'], ['speakSlowly', 'We are travelling for the first time. Please speak slowly and help us.']].find(([key]) => key === staffPhrase)?.[1]}</span><span lang={language}>{text[staffPhrase]}</span><button type="button" onClick={() => setStaffPhrase(null)}>{text.close}</button></div>}</section>
      <section className="section-card account-data"><div><h2>{text.account}</h2><p>{authUser.email}</p></div><button type="button" className="remove-button" onClick={eraseAccountData}>{text.deleteData}</button></section>
      <footer className="page-footer"><span>FirstFlight AI</span><span>{text.automated}</span></footer>
    </main>
  )
}

export default App
