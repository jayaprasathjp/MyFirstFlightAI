import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const languages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
]
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

const newTraveller = () => ({ id: crypto.randomUUID(), name: '', assistance: '', files: {}, extracted: {}, busy: {}, error: {} })
const getSavedLanguage = () => {
  try { return languages.some(({ code }) => code === localStorage.getItem('mff-language')) ? localStorage.getItem('mff-language') : 'en' }
  catch { return 'en' }
}

function App() {
  const [language, setLanguage] = useState(getSavedLanguage)
  const [travellers, setTravellers] = useState([newTraveller()])
  const [trip, setTrip] = useState({ origin: '', destination: '', departureDate: '', returnDate: '', airline: '', flightNumber: '', booking: '', baggage: '' })
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [staffPhrase, setStaffPhrase] = useState(null)
  const text = copy[language]

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
    delete extracted[kind]
    updateTraveller(traveller.id, { files, extracted, busy: { ...traveller.busy, [kind]: true }, error: { ...traveller.error, [kind]: '' } })
    const form = new FormData()
    form.append('file', file)
    form.append('document_type', kind)
    try {
      const response = await fetch(`${API_BASE_URL}/api/extract-document`, { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(response.status >= 500 ? serviceErrors[language] : text.uploadError)
      const extracted = data.extracted
      setTravellers((items) => items.map((item) => item.id === traveller.id ? { ...item, files, extracted: { ...item.extracted, [kind]: extracted }, busy: { ...item.busy, [kind]: false }, error: { ...item.error, [kind]: '' } } : item))
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: trip.origin, destination: trip.destination, departure_date: trip.departureDate, return_date: trip.returnDate || null, travellers: travellers.map(({ name, assistance, extracted }) => ({ name, assistance, documents: extracted })) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(text.failed)
      setValidation(data)
    } catch (error) {
      setValidation({ error: error.message })
    } finally { setValidating(false) }
  }

  const readyToValidate = travellers.every((person) => ['ticket', 'passport', 'visa'].every((kind) => person.extracted[kind]) && !Object.values(person.busy).some(Boolean)) && trip.origin && trip.destination && trip.departureDate
  const localizeCheck = (check) => {
    const index = Number(check.title.match(/Traveller (\d+)/)?.[1] || 1)
    const category = check.title.toLowerCase()
    const key = category.includes('missing') ? 'checkMissing' : category.includes('name') ? 'checkNames' : category.includes('passport') ? 'checkPassport' : 'checkVisa'
    const messageKey = category.includes('missing') ? 'checkMissingMessage' : category.includes('name') ? 'checkNamesMessage' : category.includes('passport') ? 'checkPassportMessage' : 'checkVisaMessage'
    return { ...check, title: `${text.traveller} ${index}: ${text[key]}`, message: check.status === 'pass' ? text.readyTitle : text[messageKey] }
  }

  return (
    <main className="page-shell">
      <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">✈</span><span>FirstFlight<span className="brand-ai"> AI</span></span></a></header>
      <section className="intro" id="top"><div className="eyebrow"><span /> {text.eyebrow}</div><h1>{text.title}<br /><em>{text.titleAccent}</em></h1><p>{text.intro}</p></section>
      <div className="stepper" aria-label={text.reviewStep}><div className="step active"><span>01</span><b>{text.languageStep}</b></div><div className="step-line" /><div className="step active"><span>02</span><b>{text.travellersStep}</b></div><div className="step-line" /><div className={`step ${validation ? 'active' : ''}`}><span>03</span><b>{text.reviewStep}</b></div></div>

      <section className="section-card language-card"><div className="section-heading"><div><div className="section-kicker">01</div><h2>{text.chooseLanguage}</h2><p>{text.languageHelp}</p></div><span className="heading-icon">文</span></div><div className="language-grid" role="group" aria-label={text.chooseLanguage}>{languages.map(({ code, label }) => <button key={code} type="button" lang={code} aria-pressed={language === code} className={`language-option ${language === code ? 'selected' : ''}`} onClick={() => changeLanguage(code)}>{label}{language === code && <span>✓</span>}</button>)}</div></section>

      <div className="traveller-header"><div><div className="section-kicker">02</div><h2>{text.travellers}</h2><p>{text.travellerHelp}</p></div><button className="add-button" onClick={() => { setTravellers((items) => [...items, newTraveller()]); setValidation(null) }}><span>＋</span> {text.addTraveller}</button></div>

      <div className="traveller-list">{travellers.map((person, index) => <article className="traveller-card" key={person.id}><div className="traveller-title"><div className="traveller-avatar">{String(index + 1).padStart(2, '0')}</div><div><h3>{text.traveller} {index + 1}</h3><span>{text.passengerDetails}</span></div>{travellers.length > 1 && <button className="remove-button" aria-label={`${text.remove} ${text.traveller} ${index + 1}`} onClick={() => { setTravellers((items) => items.filter((item) => item.id !== person.id)); setValidation(null) }}>{text.remove}</button>}</div>
        <label className="field-label">{text.name}<span>{text.nameHint}</span><input className="text-field" placeholder={text.namePlaceholder} value={person.name} onChange={(event) => updateTraveller(person.id, { name: event.target.value })} /></label>
        <div className="upload-heading"><div><h4>{text.documents}</h4><p>{text.documentsHelp}</p></div><span className="secure-note">⌑</span></div>
        <div className="document-grid">{documents.map((doc) => <label className={`document-upload ${person.extracted[doc.key] ? 'uploaded' : ''}`} key={doc.key}><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => uploadDocument(person, doc.key, event.target.files?.[0])} /><span className="document-icon">{doc.icon}</span><span className="document-title">{text[doc.key]}</span><span className="document-hint">{text[doc.hintKey]}</span><span className="upload-action">{person.busy[doc.key] ? text.reading : person.extracted[doc.key] ? `✓ ${text.extracted}` : `＋ ${text.chooseFile}`}</span>{person.files[doc.key] && <span className="file-name">{person.files[doc.key].name}</span>}{person.error[doc.key] && <span className="upload-error">{person.error[doc.key]}</span>}</label>)}</div>
        <label className="field-label assistance-label">{text.needHelp}<span>{text.optional}</span><select className="text-field" value={person.assistance} onChange={(event) => updateTraveller(person.id, { assistance: event.target.value })}><option value="">{text.noAssistance}</option><option value="wheelchair">{text.wheelchair}</option><option value="mobility">{text.mobility}</option><option value="visual">{text.visual}</option><option value="elderly">{text.elderly}</option><option value="other">{text.other}</option></select></label>
      </article>)}</div>

      <section className="section-card trip-card"><div className="section-heading"><div><h2>{text.tripTitle}</h2><p>{text.tripHelp}</p></div><span className="heading-icon">✈</span></div><div className="trip-fields"><label className="field-label">{text.origin}<input className="text-field" value={trip.origin} onChange={(event) => setTripValue('origin', event.target.value)} /></label><label className="field-label">{text.destination}<input className="text-field" value={trip.destination} onChange={(event) => setTripValue('destination', event.target.value)} /></label><label className="field-label">{text.departureDate}<input className="text-field" type="date" value={trip.departureDate} onChange={(event) => setTripValue('departureDate', event.target.value)} /></label><label className="field-label">{text.returnDate}<span>{text.returnHint}</span><input className="text-field" type="date" value={trip.returnDate} onChange={(event) => setTripValue('returnDate', event.target.value)} /></label></div><div className="trip-fields flight-summary">{[['airline', text.airline], ['flightNumber', text.flightNumber], ['booking', text.booking], ['baggage', text.baggage]].map(([key, label]) => <div className="field-label" key={key}>{label}<b>{trip[key] || text.notOnTicket}</b></div>)}</div></section>

      <section className="review-area"><div><div className="section-kicker">03</div><h2>{text.checkTitle}</h2><p>{text.checkHelp}</p>{!readyToValidate && <p className="review-hint">{text.needDocs}</p>}</div><button className="review-button" onClick={runValidation} disabled={!readyToValidate || validating}>{validating ? <><span className="spinner" /> {text.checking}</> : <>{text.checkButton} <span>→</span></>}</button></section>
      {validation && <section className={`result-card ${validation.error || validation.status === 'review' ? 'needs-review' : ''}`}><div className="result-icon">{validation.error ? '!' : validation.status === 'ready' ? '✓' : '!'}</div><div className="result-content"><div className="section-kicker">{text.resultTitle}</div><h2>{validation.error ? text.failed : validation.status === 'ready' ? text.readyTitle : text.reviewTitle}</h2>{validation.error ? <p>{validation.error}</p> : <><p>{text.automated}</p><ul>{validation.checks?.map((check, i) => { const localized = localizeCheck(check); return <li key={i}><span className={check.status === 'pass' ? 'check-pass' : 'check-warn'}>{check.status === 'pass' ? '✓' : '!'}</span><span><b>{localized.title}</b>{localized.message && <small>{localized.message}</small>}</span></li> })}</ul></>}</div></section>}
      <section className="section-card staff-card"><div className="section-heading"><div><h2>{text.helpTitle}</h2><p>{text.helpText}</p></div><span className="heading-icon">?</span></div><div className="staff-phrases">{[['askDirections', 'Please show us where to go for our flight.'], ['needWheelchair', 'We need wheelchair assistance, please.'], ['speakSlowly', 'We are travelling for the first time. Please speak slowly and help us.']].map(([key, english]) => <button type="button" key={key} onClick={() => setStaffPhrase(staffPhrase === key ? null : key)}><span>{english}</span><small lang={language}>{text[key]}</small></button>)}</div>{staffPhrase && <div className="staff-display" role="status"><b>{text.showStaff}</b><span>{[['askDirections', 'Please show us where to go for our flight.'], ['needWheelchair', 'We need wheelchair assistance, please.'], ['speakSlowly', 'We are travelling for the first time. Please speak slowly and help us.']].find(([key]) => key === staffPhrase)?.[1]}</span><span lang={language}>{text[staffPhrase]}</span><button type="button" onClick={() => setStaffPhrase(null)}>{text.close}</button></div>}</section>
      <footer className="page-footer"><span>FirstFlight AI</span><span>{text.automated}</span></footer>
    </main>
  )
}

export default App
