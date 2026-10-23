// UI translation for the traveller site. English is written in the HTML; choosing हिन्दी swaps every
// static text node and placeholder/title found in HI (keyed by the English text), and app.js re-renders
// its generated content through tr(). Choosing English or Auto restores the original text.
(() => {
  const HI = {
    // navbar
    "🏠 Home": "🏠 होम", "💬 Assistant": "💬 सहायक", "📊 Crowd": "📊 भीड़", "🛣️ Route risk": "🛣️ मार्ग जोखिम",
    "❤️ Health": "❤️ स्वास्थ्य", "🔔 Alerts": "🔔 अलर्ट", "🧭 About": "🧭 परिचय", "🏛️ Officials' dashboard": "🏛️ अधिकारी डैशबोर्ड",
    "Officials →": "अधिकारी →",
    // hero
    "🙏 Char Dham · Hemkund Sahib · 2026 season": "🙏 चारधाम · हेमकुंड साहिब · 2026 यात्रा सीज़न",
    "Your safe bridge to the": "हिमालय की", "Himalayan yatra": "सुरक्षित यात्रा का सेतु",
    "Ask about crowds, roads, weather, health and registration in English or हिन्दी, by typing or speaking. Every answer comes from official content and live data.":
      "भीड़, सड़क, मौसम, स्वास्थ्य और पंजीकरण के बारे में हिन्दी या अंग्रेज़ी में पूछें, लिखकर या बोलकर। हर उत्तर आधिकारिक जानकारी और लाइव डेटा से आता है।",
    "Ask →": "पूछें →", "Live route risk": "लाइव मार्ग जोखिम", "IMD + road status + terrain": "IMD + सड़क की स्थिति + भू-भाग",
    "7-day crowd forecast": "7 दिन का भीड़ अनुमान", "vs. carrying capacity": "धारण क्षमता की तुलना में",
    "Voice in Hindi & English": "हिन्दी और अंग्रेज़ी में आवाज़",
    // home sections
    "Why YatraSetu?": "यात्रासेतु क्यों?", "Better than the traditional yatra website": "पारंपरिक यात्रा वेबसाइट से बेहतर",
    "Traditional portals publish static notices and PDFs. YatraSetu turns them into live, personal answers. Hover or tap a card.":
      "पारंपरिक पोर्टल स्थिर सूचनाएँ और PDF देते हैं। यात्रासेतु उन्हें लाइव, व्यक्तिगत उत्तरों में बदलता है। किसी कार्ड पर माउस ले जाएँ या टैप करें।",
    "Live today": "आज लाइव", "Shrine status at a glance": "एक नज़र में धामों की स्थिति",
    "Today's crowd band and the riskiest stretch on each route, refreshed from the forecast and route-risk services.":
      "आज की भीड़ का स्तर और हर मार्ग का सबसे जोखिम भरा हिस्सा, अनुमान और मार्ग-जोखिम सेवाओं से।",
    "Everything in one place": "सब कुछ एक जगह", "Plan, check and stay safe": "योजना बनाएँ, जाँचें और सुरक्षित रहें",
    "Multilingual assistant": "बहुभाषी सहायक",
    "Grounded answers with sources and dates. Voice in and out.": "स्रोत और तारीख के साथ प्रमाणित उत्तर। बोलकर पूछें, सुनकर जानें।",
    "Open →": "खोलें →", "Crowd forecast": "भीड़ का अनुमान",
    "7 days ahead, lighter dates and alternative shrines.": "7 दिन आगे का अनुमान, कम भीड़ वाली तारीखें और वैकल्पिक धाम।",
    "Route risk map": "मार्ग जोखिम मानचित्र",
    "Every segment scored and explained, with a safe-halt suggestion.": "हर हिस्से का जोखिम स्कोर और कारण, सुरक्षित पड़ाव के सुझाव के साथ।",
    "Health readiness": "स्वास्थ्य तैयारी",
    "High-altitude self-check, screening points and medical posts.": "ऊँचाई के लिए स्व-जाँच, स्क्रीनिंग पॉइंट और चिकित्सा केंद्र।",
    "Trip alerts": "यात्रा अलर्ट", "WhatsApp alerts for your route, with SMS fallback.": "आपके मार्ग के लिए WhatsApp अलर्ट, SMS विकल्प के साथ।",
    "Nearest medical help, a 112 dialler and location sharing.": "नज़दीकी चिकित्सा सहायता, 112 डायलर और लोकेशन साझा करना।",
    "% top-3 retrieval accuracy": "% टॉप-3 खोज सटीकता", "% emergency recall": "% आपात स्थिति की पहचान",
    "% crowd-band accuracy": "% भीड़-स्तर सटीकता", "shrines · 2 languages": "धाम · 2 भाषाएँ",
    "🚑 Emergency numbers": "🚑 आपातकालीन नंबर",
    "These stay available offline once the app has been opened.": "ऐप एक बार खोलने के बाद ये बिना नेटवर्क के भी उपलब्ध रहते हैं।",
    "Emergency": "आपातकाल", "Ambulance": "एम्बुलेंस", "Cyber fraud": "साइबर धोखाधड़ी",
    // assistant
    "Home / Assistant": "होम / सहायक", "Ask YatraSetu": "यात्रासेतु से पूछें",
    "Type, tap a suggestion or speak. Answers come from official content and live data, and the sources are shown.":
      "लिखें, किसी सुझाव पर टैप करें या बोलें। उत्तर आधिकारिक जानकारी और लाइव डेटा से आते हैं और स्रोत दिखाए जाते हैं।",
    "🔊 Auto-read": "🔊 स्वतः पढ़ें", "🗑️ Clear": "🗑️ साफ करें", "Send ➤": "भेजें ➤", "🎙️ Voice commands": "🎙️ आवाज़ कमांड",
    "Tap a 🎙️ button and speak. If what you say is not a command, it is sent to the assistant as a question.":
      "🎙️ बटन दबाएँ और बोलें। अगर आपकी बात कोई कमांड नहीं है, तो उसे सहायक से प्रश्न के रूप में पूछा जाता है।",
    "opens the forecast for that shrine": "उस धाम का अनुमान खोलता है", "scores the route": "मार्ग का जोखिम जाँचता है",
    "navigates": "पेज खोलता है", "opens SOS (you still press the button)": "SOS खोलता है (बटन आपको ही दबाना है)",
    "speech playback": "सुनना / रोकना", "Hindi navigation": "हिन्दी में नेविगेशन",
    "How this answer was made": "यह उत्तर कैसे बना", "Language detection": "भाषा की पहचान",
    "Intent + emergency check": "प्रश्न का प्रकार + आपात जाँच", "Hybrid retrieval (RAG)": "हाइब्रिड खोज (RAG)",
    "Live crowd / route data": "लाइव भीड़ / मार्ग डेटा", "Grounded answer + guardrails": "प्रमाणित उत्तर + सुरक्षा जाँच",
    // crowd
    "Home / Crowd forecast": "होम / भीड़ का अनुमान",
    "Expected visitors compared with the shrine's daily carrying capacity, so you can pick a lighter day.":
      "धाम की दैनिक धारण क्षमता की तुलना में अनुमानित श्रद्धालु, ताकि आप कम भीड़ वाला दिन चुन सकें।",
    "Shrine": "धाम", "Start date": "आरंभ तिथि", "Forecast": "अनुमान",
    "Bands: Low < 60% of capacity · Moderate 60–85% · High 85–100% · Over capacity > 100%. Capacity values from the 2025 carrying-capacity study. Model: gradient-boosted trees trained on past seasons.":
      "स्तर: कम < 60% क्षमता · मध्यम 60–85% · अधिक 85–100% · क्षमता से अधिक > 100%। क्षमता के आँकड़े 2025 के धारण-क्षमता अध्ययन से। मॉडल: पिछले सीज़न के डेटा पर प्रशिक्षित ग्रेडिएंट-बूस्टेड ट्री।",
    // route
    "Home / Route risk": "होम / मार्ग जोखिम", "Live route-risk map": "लाइव मार्ग-जोखिम मानचित्र",
    "Each segment is scored from IMD alerts, forecast rain, official road status and terrain.":
      "हर हिस्से का स्कोर IMD अलर्ट, वर्षा के अनुमान, सड़क की आधिकारिक स्थिति और भू-भाग से बनता है।",
    "Route network": "मार्ग नेटवर्क",
    "Hover or tap a segment to see why it has that risk level.": "किसी हिस्से पर माउस ले जाएँ या टैप करें, जोखिम का कारण दिखेगा।",
    "Click or tap a segment to see why it has that risk level.": "किसी हिस्से पर क्लिक या टैप करें, जोखिम का कारण दिखेगा।",
    "Segment details": "हिस्से का विवरण", "Select a segment on the map, or use": "मानचित्र पर कोई हिस्सा चुनें, या",
    "to check the risk where you are.": "से अपनी जगह का जोखिम देखें।", "📍 Near me": "📍 मेरे पास", "Near me": "मेरे पास",
    "↻ Refresh": "↻ ताज़ा करें", "Plan my trip": "मेरी यात्रा की योजना", "Starting from": "कहाँ से", "Departure": "प्रस्थान",
    "Vehicle": "वाहन", "Car / taxi": "कार / टैक्सी", "Bus / tempo traveller": "बस / टेम्पो ट्रैवलर", "Two-wheeler": "दोपहिया",
    "Plan trip": "योजना बनाएँ", "Live alerts": "लाइव अलर्ट", "Compare shrine routes": "धामों के मार्गों की तुलना",
    "Safest route first. Each block is one segment, coloured by its risk.": "सबसे सुरक्षित मार्ग पहले। हर खाना एक हिस्सा है, जिसका रंग उसका जोखिम बताता है।",
    "IMD alert": "IMD अलर्ट", "Rain": "वर्षा", "Terrain": "भू-भाग", "Road status": "सड़क की स्थिति", "None": "कोई नहीं",
    "Open": "खुली", "Restricted": "प्रतिबंधित", "On foot": "पैदल", "Road": "सड़क",
    "stay": "ठहरना", "hospital": "अस्पताल", "medical": "चिकित्सा", "fuel": "ईंधन", "police": "पुलिस", "screening": "स्क्रीनिंग", "shelter": "आश्रय",
    "Finding your location…": "आपकी लोकेशन ढूँढ रहे हैं…",
    "Check my route": "मेरा मार्ग जाँचें", "Destination": "गंतव्य", "Check route": "मार्ग जाँचें",
    // health
    "Home / Health check": "होम / स्वास्थ्य जाँच", "Pre-trip health readiness": "यात्रा से पहले स्वास्थ्य तैयारी",
    "Kedarnath is at 3,583 m and Hemkund Sahib at 4,632 m. Check you are ready before you climb.":
      "केदारनाथ 3,583 मीटर और हेमकुंड साहिब 4,632 मीटर की ऊँचाई पर हैं। चढ़ाई से पहले अपनी तैयारी जाँचें।",
    "Self-check": "स्व-जाँच", "Age": "आयु", "Walking fitness": "चलने की क्षमता", "Known conditions": "मौजूदा बीमारियाँ",
    "High blood pressure": "उच्च रक्तचाप", "Diabetes": "मधुमेह", "Heart disease": "हृदय रोग",
    "Asthma / lung disease": "अस्थमा / फेफड़ों की बीमारी", "Pregnancy": "गर्भावस्था", "Right now, do you have…": "क्या अभी आपको…",
    "Chest pain or pressure": "सीने में दर्द या दबाव", "Breathlessness at rest": "आराम करते समय भी साँस फूलना",
    "Surgery / heart attack in last 6 months": "पिछले 6 महीनों में सर्जरी / दिल का दौरा",
    "Check readiness": "तैयारी जाँचें", "Your readiness plan": "आपकी तैयारी योजना",
    "Fill in the form to get guidance.": "मार्गदर्शन के लिए फ़ॉर्म भरें।",
    "Can walk 10 km easily": "10 किमी आराम से चल सकते हैं", "Can walk 5 km": "5 किमी चल सकते हैं",
    "Struggle to walk 5 km": "5 किमी चलने में कठिनाई",
    // alerts & SOS
    "Home / Trip alerts & SOS": "होम / यात्रा अलर्ट और SOS", "Trip alerts & SOS": "यात्रा अलर्ट और SOS",
    "Get WhatsApp alerts for your route and reach help quickly if something goes wrong.":
      "अपने मार्ग के WhatsApp अलर्ट पाएँ और कुछ गड़बड़ होने पर जल्दी मदद तक पहुँचें।",
    "Subscribe my trip for alerts": "मेरी यात्रा के अलर्ट शुरू करें", "Mobile (WhatsApp)": "मोबाइल (WhatsApp)",
    "Alert language": "अलर्ट की भाषा", "Group size": "समूह में लोग", "From": "से", "To": "तक",
    "I agree that YatraSetu stores my trip details only to send safety alerts, and deletes them 90 days after the trip.":
      "मैं सहमत हूँ कि यात्रासेतु मेरी यात्रा की जानकारी केवल सुरक्षा अलर्ट भेजने के लिए रखेगा और यात्रा के 90 दिन बाद उसे हटा देगा।",
    "Subscribe": "सदस्यता लें", "🚨 Emergency SOS": "🚨 आपातकालीन SOS",
    "Finds the nearest medical help, opens the 112 dialler and prepares a location message for your family.":
      "नज़दीकी चिकित्सा सहायता ढूँढता है, 112 डायलर खोलता है और परिवार के लिए लोकेशन संदेश तैयार करता है।",
    "Latitude": "अक्षांश", "Longitude": "देशांतर", "📍 Locate me": "📍 मेरी लोकेशन", "Emergency contact": "आपातकालीन संपर्क",
    "Offline emergency card": "ऑफ़लाइन आपात कार्ड",
    "Emergency 112 · Ambulance 108 · Cyber fraud 1930. Add this site to your home screen and the card stays available without a network.":
      "आपातकाल 112 · एम्बुलेंस 108 · साइबर धोखाधड़ी 1930। इस साइट को होम स्क्रीन पर जोड़ें, यह कार्ड बिना नेटवर्क के भी उपलब्ध रहेगा।",
    // about
    "Home / About": "होम / परिचय", "About YatraSetu AI": "यात्रासेतु AI का परिचय",
    "A minor project (B.Tech CSE, AI/ML) at Roorkee Institute of Technology.": "रुड़की इंस्टीट्यूट ऑफ टेक्नोलॉजी का माइनर प्रोजेक्ट (B.Tech CSE, AI/ML)।",
    "Setu": "सेतु", "means bridge: it connects pilgrims with verified safety information in their own language.":
      "का अर्थ है पुल: यह श्रद्धालुओं को उनकी अपनी भाषा में प्रमाणित सुरक्षा जानकारी से जोड़ता है।",
    "System architecture": "सिस्टम आर्किटेक्चर", "How the pieces fit together": "सभी हिस्से कैसे जुड़ते हैं",
    "Click any block to see what it does and which file implements it. Arrows show the request flowing down and the answer flowing back.":
      "किसी भी ब्लॉक पर क्लिक करें और देखें कि वह क्या करता है और किस फ़ाइल में है। तीर अनुरोध को नीचे जाते और उत्तर को वापस आते दिखाते हैं।",
    "Assistant pipeline": "सहायक पाइपलाइन", "From question to grounded answer": "प्रश्न से प्रमाणित उत्तर तक",
    "Input": "इनपुट", "Text or voice (Web Speech API)": "लिखकर या बोलकर (Web Speech API)", "Language": "भाषा",
    "Script detection, Bhashini for other languages": "लिपि से पहचान, अन्य भाषाओं के लिए भाषिणी", "Intent": "प्रश्न का प्रकार",
    "TF-IDF + logistic regression. Emergencies are routed to a fixed safety reply.": "TF-IDF + लॉजिस्टिक रिग्रेशन। आपात स्थिति में तय सुरक्षा उत्तर मिलता है।",
    "Retrieve": "खोज", "Hybrid TF-IDF over the bilingual knowledge base, re-ranked by shrine": "द्विभाषी ज्ञानकोष पर हाइब्रिड TF-IDF खोज, धाम के अनुसार क्रम",
    "Live data": "लाइव डेटा", "Crowd forecast and route risk": "भीड़ का अनुमान और मार्ग जोखिम", "Answer": "उत्तर",
    "OpenRouter LLM via LangChain, or extractive. Numbers checked, PII redacted.": "LangChain से OpenRouter LLM, या पाठ से सीधा उत्तर। अंकों की जाँच, निजी जानकारी छिपाई जाती है।",
    "Reply": "जवाब", "Text with sources, read aloud on request": "स्रोतों के साथ उत्तर, चाहें तो पढ़कर सुनाया जाता है",
    "▶ Play the flow": "▶ प्रवाह चलाएँ", "Project structure": "प्रोजेक्ट संरचना", "Repository map": "रिपॉज़िटरी मानचित्र",
    "Hover a file to highlight its block in the diagram.": "किसी फ़ाइल पर माउस ले जाएँ, आरेख में उसका ब्लॉक उभरेगा।",
    "🧰 Tech stack": "🧰 तकनीक", "📏 Evaluation": "📏 मूल्यांकन", "🎙️ Voice: current limits": "🎙️ आवाज़: मौजूदा सीमाएँ",
    "Voice input uses the browser's Web Speech API. It works in Chrome, Edge and Safari, not in Firefox.":
      "आवाज़ इनपुट ब्राउज़र के Web Speech API से चलता है। यह Chrome, Edge और Safari में काम करता है, Firefox में नहीं।",
    "It needs microphone permission and": "इसके लिए माइक्रोफ़ोन की अनुमति और", "or HTTPS.": "या HTTPS चाहिए।",
    "Chrome sends audio to its own cloud speech service, so it does not work offline.": "Chrome आवाज़ को अपनी क्लाउड स्पीच सेवा पर भेजता है, इसलिए यह ऑफ़लाइन काम नहीं करता।",
    "English (en-IN) and Hindi (hi-IN) only. Garhwali, Kumaoni and other languages are planned through Bhashini speech recognition.":
      "केवल अंग्रेज़ी (en-IN) और हिन्दी (hi-IN)। गढ़वाली, कुमाऊँनी और अन्य भाषाएँ भाषिणी स्पीच रिकग्निशन से जोड़ने की योजना है।",
    "Read-aloud uses the voices installed on the device. Some devices have no Hindi voice.":
      "पढ़कर सुनाने के लिए डिवाइस में इंस्टॉल आवाज़ें इस्तेमाल होती हैं। कुछ डिवाइस में हिन्दी आवाज़ नहीं होती।",
    "📷 Image credits": "📷 चित्र आभार",
    "Backgrounds are openly licensed photographs from Wikimedia Commons, used under their licences:":
      "पृष्ठभूमि के चित्र विकिमीडिया कॉमन्स के खुले लाइसेंस वाले फ़ोटो हैं, जो उनके लाइसेंस के अनुसार उपयोग किए गए हैं:",
    "Project: Ayush Singh (Roll No. 230240170024), Department of CSE, Roorkee Institute of Technology. Prototype with demo data; verify with official sources.":
      "प्रोजेक्ट: आयुष सिंह (रोल नं. 230240170024), CSE विभाग, रुड़की इंस्टीट्यूट ऑफ टेक्नोलॉजी। डेमो डेटा वाला प्रोटोटाइप; आधिकारिक स्रोतों से पुष्टि करें।",
    // footer, overlay
    "Multilingual, voice-enabled safe-travel and crowd advisory assistant for Uttarakhand.": "उत्तराखंड के लिए बहुभाषी, आवाज़ से चलने वाला सुरक्षित यात्रा और भीड़ सलाह सहायक।",
    "Explore": "देखें", "Assistant": "सहायक", "Route risk": "मार्ग जोखिम", "About": "परिचय",
    "112 Emergency": "112 आपातकाल", "108 Ambulance": "108 एम्बुलेंस", "1930 Cyber fraud": "1930 साइबर धोखाधड़ी",
    "Prototype · Minor Project, Department of CSE, Roorkee Institute of Technology · Demo data, verify with official sources · Photos: Wikimedia Commons (see About)":
      "प्रोटोटाइप · माइनर प्रोजेक्ट, CSE विभाग, रुड़की इंस्टीट्यूट ऑफ टेक्नोलॉजी · डेमो डेटा, आधिकारिक स्रोतों से पुष्टि करें · फ़ोटो: विकिमीडिया कॉमन्स (परिचय देखें)",
    "Cancel": "रद्द करें",
    // placeholders and tooltips
    "Answer & voice language": "उत्तर और आवाज़ की भाषा", "Voice command": "आवाज़ कमांड", "Emergency SOS": "आपातकालीन SOS",
    "Try: “Is the road to Kedarnath open?”": "जैसे: “क्या केदारनाथ का रास्ता खुला है?”", "Ask by voice": "बोलकर पूछें",
    "Read replies aloud": "उत्तर पढ़कर सुनाएँ", "Clear conversation": "बातचीत साफ करें", "Speak your question": "अपना प्रश्न बोलें",
    "Ask in English or हिन्दी, e.g. Is Kedarnath crowded this week? (press / to focus)": "हिन्दी या English में पूछें, जैसे: इस हफ्ते केदारनाथ में भीड़ कैसी है?",
    "Use my phone's location": "फ़ोन की लोकेशन लें",
    // generated by app.js
    "Low": "कम", "Moderate": "मध्यम", "High": "अधिक", "Over capacity": "क्षमता से अधिक", "Closed": "बंद",
    "Green": "हरा", "Yellow": "पीला", "Orange": "नारंगी", "Red": "लाल",
    "Ready": "तैयार", "Caution": "सावधानी", "Consult doctor first": "पहले डॉक्टर से सलाह लें", "Do not trek now": "अभी ट्रेक न करें",
    "👥 Crowd today": "👥 आज भीड़", "🛣️ Route": "🛣️ मार्ग", "Route": "मार्ग",
    "🔊 Listen": "🔊 सुनें", "📋 Copy": "📋 कॉपी", "📞 Call 112": "📞 112 पर कॉल करें", "🚨 Open SOS": "🚨 SOS खोलें",
    "🛣️ Show on route map": "🛣️ मार्ग मानचित्र पर देखें", "❤️ Open health check": "❤️ स्वास्थ्य जाँच खोलें",
    "🎙️ spoken": "🎙️ बोला गया", "Hover or tap to compare →": "तुलना के लिए माउस ले जाएँ या टैप करें →",
    "Why": "क्यों", "What to do": "क्या करें", "On your route": "आपके मार्ग पर", "Screening": "स्क्रीनिंग", "Medical posts": "चिकित्सा केंद्र",
    "Nearest help:": "नज़दीकी मदद:", "Share on WhatsApp": "WhatsApp पर साझा करें", "Tip:": "सुझाव:", "click a block above.": "ऊपर किसी ब्लॉक पर क्लिक करें।",
    "Answer copied": "उत्तर कॉपी हो गया", "Chat cleared": "बातचीत साफ हो गई",
  };
  // Dynamic content that is not a straight lookup.
  const HI_LISTS = {
    greeting: "नमस्ते! 🙏 मैं यात्रासेतु हूँ। चारधाम यात्रा में भीड़, रास्ते, पंजीकरण, स्वास्थ्य या सुरक्षा के बारे में हिन्दी या अंग्रेज़ी में पूछें। आप 🎙️ दबाकर बोल भी सकते हैं।",
    quick: ["इस हफ्ते केदारनाथ में भीड़ कैसी है?", "क्या केदारनाथ का रास्ता खुला है?", "यात्रा के लिए पंजीकरण कैसे करें?",
      "मेरे पिता 68 साल के हैं और उन्हें बीपी है, क्या वे ट्रेक कर सकते हैं?", "हेमकुंड साहिब के लिए क्या सामान ले जाएँ?",
      "केदारनाथ में कल कितनी भीड़ होगी?", "हेलीकॉप्टर टिकट कैसे बुक करें?"],
    hero: ["इस हफ्ते केदारनाथ में भीड़ कैसी है?", "क्या बद्रीनाथ का रास्ता खुला है?", "यात्रा के लिए पंजीकरण कैसे करें?", "हेलीकॉप्टर टिकट कैसे बुक करें?"],
  };

  const norm = s => s.replace(/\s+/g, " ").trim();
  const SKIP = "script,style,select,#chat,#details,#arch,#tree,#credits,#shrine-grid,#why-grid,#hero-chips,#quick,#c-days,#c-pills,"
    + "#r-out,#rk-kpis,#rk-feed,#rk-compare,#rk-updated,#h-out .result,#s-out,#sos-out,#c-suggest,#map,#ai-status,#voice-support,#voice-note,#ai-mode,#node-detail,.toast,.chips,table,kbd";
  const original = new WeakMap();
  let lang = "en";

  const tr = s => (lang === "hi" && HI[norm(String(s))]) || s;

  function apply(next) {
    lang = next === "hi" ? "hi" : "en";
    document.documentElement.lang = lang;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!n.parentElement || n.parentElement.closest(SKIP)) continue;
      const en = original.has(n) ? original.get(n) : n.nodeValue;
      const hi = HI[norm(en)];
      if (!hi) continue;
      original.set(n, en);
      const [, lead, , trail] = en.match(/^(\s*)([\s\S]*?)(\s*)$/);
      n.nodeValue = lang === "hi" ? lead + hi + trail : en;
    }
    document.querySelectorAll("[placeholder],[title],option").forEach(el => {
      if (el.closest("#lang")) return;
      for (const a of el.tagName === "OPTION" ? ["text"] : ["placeholder", "title"]) {
        const key = "en_" + a, cur = a === "text" ? el.textContent : el.getAttribute(a);
        if (cur == null) continue;
        const en = el.dataset[key] ?? cur, hi = HI[norm(en)];
        if (!hi) continue;
        el.dataset[key] = en;
        const v = lang === "hi" ? hi : en;
        if (a === "text") el.textContent = v; else el.setAttribute(a, v);
      }
    });
  }

  window.I18N = { tr, apply, get lang() { return lang; }, list: k => HI_LISTS[k] };
})();
