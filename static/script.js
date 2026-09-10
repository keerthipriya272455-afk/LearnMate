// ============================================================
// QUIZ SYSTEM
// ============================================================

let quizData = [];
let currentQuestion = 0;
let selectedAnswers = {};
let quizRecorded = false;


// ============================================================
// GENERATE QUIZ
// ============================================================

async function generateQuiz() {

    const topicInput = getElement("quizTopic");
    const numberInput = getElement("quizNumber");
    const difficultyInput = getElement("quizDifficulty");

    const generateBtn = getElement("quizGenerateBtn");
    const loading = getElement("quizLoading");
    const quizArea = getElement("quizArea");
    const quizResult = getElement("quizResult");
    const errorBox = getElement("quizError");

    if (!topicInput || !generateBtn) {
        console.error("Quiz page elements are missing.");
        return;
    }

    const topic = topicInput.value.trim();
    const number = Number(numberInput?.value || 5);
    const difficulty = difficultyInput?.value || "Medium";

    if (!topic) {

        if (errorBox) {
            errorBox.innerText = "⚠️ Please enter a topic first.";
            errorBox.style.display = "block";
        }

        topicInput.focus();
        return;
    }

    quizData = [];
    currentQuestion = 0;
    selectedAnswers = {};
    quizRecorded = false;

    if (errorBox) {
        errorBox.innerText = "";
        errorBox.style.display = "none";
    }

    if (quizResult) {
        quizResult.style.display = "none";
    }

    if (quizArea) {
        quizArea.style.display = "none";
    }

    if (loading) {
        loading.style.display = "block";
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = "🤖 Creating Quiz...";

    try {

        const response = await fetch(
            "/api/generate-quiz",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    topic: topic,
                    number: number,
                    difficulty: difficulty
                })
            }
        );

        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error(
                "The server returned an invalid response."
            );
        }

        console.log("Quiz response:", data);

        if (!response.ok || data.error) {
            throw new Error(
                data.error ||
                "Unable to generate quiz."
            );
        }

        if (
            !Array.isArray(data.questions) ||
            data.questions.length === 0
        ) {
            throw new Error(
                "No questions were generated."
            );
        }

        quizData = data.questions;

        currentQuestion = 0;
        selectedAnswers = {};
        quizRecorded = false;

        if (loading) {
            loading.style.display = "none";
        }

        if (quizArea) {
            quizArea.style.display = "block";
        }

        const title =
            getElement("quizTopicTitle");

        if (title) {
            title.innerText = topic;
        }

        createQuizDots();

        displayQuizQuestion();

    } catch (error) {

        console.error(
            "❌ QUIZ ERROR:",
            error
        );

        if (loading) {
            loading.style.display = "none";
        }

        if (errorBox) {
            errorBox.innerText =
                "❌ " +
                (error.message || "Unable to generate quiz.");

            errorBox.style.display = "block";
        }

    } finally {

        generateBtn.disabled = false;

        generateBtn.innerHTML =
            "<span>✨</span> Generate Quiz <span>→</span>";
    }
}


// ============================================================
// DISPLAY QUESTION
// ============================================================

function displayQuizQuestion() {

    if (!quizData.length) {
        return;
    }

    const question =
        quizData[currentQuestion];

    if (!question) {
        return;
    }


    // QUESTION TEXT

    const questionText =
        getElement("questionText");

    if (questionText) {
        questionText.innerText =
            question.question || "";
    }


    // QUESTION NUMBER

    const questionNumber =
        getElement("questionNumber");

    if (questionNumber) {

        questionNumber.innerText =
            `QUESTION ${String(currentQuestion + 1).padStart(2, "0")}`;
    }


    // COUNTER

    const counter =
        getElement("quizCounter");

    if (counter) {

        counter.innerText =
            `${currentQuestion + 1} / ${quizData.length}`;
    }


    // PROGRESS

    const progress =
        getElement("quizProgress");

    if (progress) {

        const percentage =
            ((currentQuestion + 1) /
                quizData.length) * 100;

        progress.style.width =
            `${percentage}%`;
    }


    // FEEDBACK

    const feedback =
        getElement("quizFeedback");

    if (feedback) {

        feedback.innerText = "";
        feedback.style.display = "none";
    }


    // OPTIONS

    const container =
        getElement("optionsContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";


    const options =
        question.options || {};


    ["A", "B", "C", "D"].forEach(
        function(letter) {

            if (
                options[letter] === undefined
            ) {
                return;
            }

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "quiz-option";

            button.dataset.answer =
                letter;

            button.innerHTML = `
                <span class="option-letter">
                    ${letter}
                </span>

                <span class="option-text">
                    ${escapeQuizText(options[letter])}
                </span>
            `;


            // RESTORE ANSWER

            if (
                selectedAnswers[currentQuestion] ===
                letter
            ) {

                button.classList.add("selected");
            }


            button.addEventListener(
                "click",
                function() {

                    selectQuizAnswer(letter);

                }
            );

            container.appendChild(button);
        }
    );


    // PREVIOUS BUTTON

    const prevBtn =
        getElement("quizPrevBtn");

    if (prevBtn) {

        prevBtn.disabled =
            currentQuestion === 0;
    }


    // NEXT BUTTON

    const nextBtn =
        getElement("quizNextBtn");

    if (nextBtn) {

        if (
            currentQuestion ===
            quizData.length - 1
        ) {

            nextBtn.innerText =
                "Finish Quiz ✓";

        } else {

            nextBtn.innerText =
                "Next Question →";
        }
    }


    updateQuizDots();
}


// ============================================================
// SELECT ANSWER
// ============================================================

function selectQuizAnswer(letter) {

    if (!quizData[currentQuestion]) {
        return;
    }

    selectedAnswers[currentQuestion] =
        letter;


    const options =
        document.querySelectorAll(
            ".quiz-option"
        );

    options.forEach(
        function(option) {

            option.classList.remove(
                "selected"
            );
        }
    );


    const selected =
        document.querySelector(
            `.quiz-option[data-answer="${letter}"]`
        );

    if (selected) {

        selected.classList.add(
            "selected"
        );
    }


    console.log(
        "Selected:",
        currentQuestion,
        letter
    );
}


// ============================================================
// NEXT QUESTION
// ============================================================

function nextQuizQuestion() {

    if (!quizData.length) {
        return;
    }


    const answer =
        selectedAnswers[currentQuestion];


    if (!answer) {

        showQuizFeedback(
            "⚠️ Please select an answer first."
        );

        return;
    }


    if (
        currentQuestion ===
        quizData.length - 1
    ) {

        finishQuiz();

        return;
    }


    currentQuestion++;

    displayQuizQuestion();
}


// ============================================================
// PREVIOUS QUESTION
// ============================================================

function previousQuizQuestion() {

    if (
        currentQuestion <= 0
    ) {
        return;
    }

    currentQuestion--;

    displayQuizQuestion();
}


// ============================================================
// FEEDBACK
// ============================================================

function showQuizFeedback(message) {

    const feedback =
        getElement("quizFeedback");

    if (!feedback) {
        return;
    }

    feedback.innerText =
        message;

    feedback.style.display =
        "block";
}


// ============================================================
// FINISH QUIZ
// ============================================================

async function finishQuiz() {

    let score = 0;


    // CALCULATE SCORE

    quizData.forEach(
        function(question, index) {

            const selected =
                selectedAnswers[index];

            const correct =
                String(
                    question.answer || ""
                )
                .trim()
                .toUpperCase();


            if (
                selected &&
                selected.toUpperCase() ===
                correct
            ) {

                score++;
            }
        }
    );


    console.log(
        "FINAL SCORE:",
        score,
        "/",
        quizData.length
    );


    // HIDE QUIZ

    const quizArea =
        getElement("quizArea");

    if (quizArea) {
        quizArea.style.display = "none";
    }


    // SHOW RESULT

    const quizResult =
        getElement("quizResult");

    if (quizResult) {
        quizResult.style.display = "block";
    }


    const finalScore =
        getElement("finalScore");

    if (finalScore) {

        finalScore.innerText =
            `You scored ${score} / ${quizData.length}`;
    }


    // SHOW ANSWERS

    showQuizReview();


    // RECORD ONCE

    if (!quizRecorded) {

        quizRecorded = true;

        await recordQuizResult(
            score,
            quizData.length
        );
    }
}


// ============================================================
// SHOW CORRECT ANSWERS + REVIEW
// ============================================================

function showQuizReview() {

    const quizResult =
        getElement("quizResult");

    if (!quizResult) {
        return;
    }


    // REMOVE OLD REVIEW

    const oldReview =
        getElement("quizAnswerReview");

    if (oldReview) {
        oldReview.remove();
    }


    // CREATE REVIEW

    const review =
        document.createElement("div");

    review.id =
        "quizAnswerReview";

    review.className =
        "quiz-answer-review";


    const heading =
        document.createElement("h3");

    heading.innerText =
        "Answer Review";

    review.appendChild(heading);


    quizData.forEach(
        function(question, index) {

            const selected =
                selectedAnswers[index] || "Not answered";

            const correct =
                String(
                    question.answer || ""
                )
                .trim()
                .toUpperCase();


            const item =
                document.createElement("div");

            item.className =
                "quiz-review-item";


            const questionTitle =
                document.createElement("div");

            questionTitle.className =
                "quiz-review-question";

            questionTitle.innerText =
                `${index + 1}. ${question.question}`;


            const selectedText =
                document.createElement("div");

            selectedText.className =
                "quiz-review-selected";

            selectedText.innerText =
                `Your answer: ${selected}`;


            const correctText =
                document.createElement("div");

            correctText.className =
                "quiz-review-correct";

            correctText.innerText =
                `Correct answer: ${correct}`;


            item.appendChild(questionTitle);
            item.appendChild(selectedText);
            item.appendChild(correctText);

            review.appendChild(item);
        }
    );


    quizResult.appendChild(review);
}


// ============================================================
// QUIZ DOTS
// ============================================================

function createQuizDots() {

    const container =
        getElement("quizDots");

    if (!container) {
        return;
    }

    container.innerHTML = "";


    quizData.forEach(
        function(_, index) {

            const dot =
                document.createElement("span");

            dot.className =
                "quiz-dot-item";


            if (
                index === currentQuestion
            ) {

                dot.classList.add("active");
            }


            dot.addEventListener(
                "click",
                function() {

                    currentQuestion =
                        index;

                    displayQuizQuestion();
                }
            );


            container.appendChild(dot);
        }
    );
}


// ============================================================
// UPDATE QUIZ DOTS
// ============================================================

function updateQuizDots() {

    const dots =
        document.querySelectorAll(
            ".quiz-dot-item"
        );

    dots.forEach(
        function(dot, index) {

            dot.classList.toggle(
                "active",
                index === currentQuestion
            );
        }
    );
}


// ============================================================
// RESTART QUIZ
// ============================================================

function restartQuiz() {

    const quizResult =
        getElement("quizResult");

    const quizArea =
        getElement("quizArea");

    const topicInput =
        getElement("quizTopic");


    if (quizResult) {
        quizResult.style.display = "none";
    }

    if (quizArea) {
        quizArea.style.display = "none";
    }


    if (topicInput) {
        topicInput.focus();
    }

    quizData = [];
    currentQuestion = 0;
    selectedAnswers = {};
    quizRecorded = false;
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeQuizText(text) {

    const div =
        document.createElement("div");

    div.textContent =
        String(text);

    return div.innerHTML;
}


// ============================================================
// QUIZ PAGE SETUP
// ============================================================

function setupQuizPage() {

    const generateBtn =
        getElement("quizGenerateBtn");

    const nextBtn =
        getElement("quizNextBtn");

    const prevBtn =
        getElement("quizPrevBtn");

    const restartBtn =
        getElement("restartQuizBtn");


    if (generateBtn) {

        generateBtn.addEventListener(
            "click",
            generateQuiz
        );
    }


    if (nextBtn) {

        nextBtn.addEventListener(
            "click",
            nextQuizQuestion
        );
    }


    if (prevBtn) {

        prevBtn.addEventListener(
            "click",
            previousQuizQuestion
        );
    }


    if (restartBtn) {

        restartBtn.addEventListener(
            "click",
            restartQuiz
        );
    }


    console.log(
        "✅ Quiz page initialized."
    );
}


// ============================================================
// QUIZ KEYBOARD CONTROLS
// ============================================================

document.addEventListener(
    "keydown",
    function(event) {

        const activeElement =
            document.activeElement;

        const typing =
            activeElement &&
            (
                activeElement.tagName === "INPUT" ||
                activeElement.tagName === "TEXTAREA" ||
                activeElement.tagName === "SELECT"
            );

        if (typing) {
            return;
        }

        const quizArea =
            getElement("quizArea");

        const quizVisible =
            quizArea &&
            quizArea.style.display !== "none";

        if (quizVisible) {

            if (event.key === "ArrowRight") {

                nextQuizQuestion();
                return;
            }

            if (event.key === "ArrowLeft") {

                previousQuizQuestion();
                return;
            }
        }
    }
);

     




// ============================================================
// FLASHCARDS - COMPLETE WORKING SECTION
// ============================================================

// Make sure getElement exists
function getElement(id) {
    return document.getElementById(id);
}


// ============================================================
// FLASHCARD VARIABLES
// ============================================================

let flashcards = [];
let currentCard = 0;
let isFlipped = false;


// ============================================================
// GENERATE FLASHCARDS
// ============================================================

async function generateFlashcards() {

    const topicInput = getElement("flashcardTopic");
    const numberInput = getElement("flashcardNumber");
    const button = getElement("generateBtn");
    const loading = getElement("flashcardLoading");
    const area = getElement("flashcardArea");
    const errorBox = getElement("flashcardError");

    // Not on flashcard page
    if (!topicInput || !button) {
        console.log("Flashcard page not detected.");
        return;
    }

    const topic = topicInput.value.trim();

    const number = Number(
        numberInput ? numberInput.value : 5
    );

    // --------------------------------------------------------
    // CHECK TOPIC
    // --------------------------------------------------------

    if (!topic) {

        if (errorBox) {
            errorBox.textContent =
                "⚠️ Please enter a topic first.";

            errorBox.style.display = "block";
        }

        topicInput.focus();

        return;
    }

    // --------------------------------------------------------
    // RESET UI
    // --------------------------------------------------------

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.style.display = "none";
    }

    if (area) {
        area.style.display = "none";
    }

    if (loading) {
        loading.style.display = "block";
    }

    button.disabled = true;
    button.innerHTML = "🤖 Creating...";

    try {

        console.log("Generating flashcards for:", topic);

        // ----------------------------------------------------
        // CALL FLASK
        // ----------------------------------------------------

        const response = await fetch(
            "/api/generate-flashcards",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    topic: topic,
                    number: number
                })
            }
        );

        // ----------------------------------------------------
        // CHECK RESPONSE
        // ----------------------------------------------------

        let data;

        try {
            data = await response.json();
        } catch (jsonError) {

            throw new Error(
                "Server returned an invalid response."
            );
        }

        console.log("Flashcard API response:", data);

        // ----------------------------------------------------
        // API ERROR
        // ----------------------------------------------------

        if (!response.ok || data.error) {

            throw new Error(
                data.error ||
                "Unable to generate flashcards."
            );
        }

        // ----------------------------------------------------
        // GET FLASHCARDS
        // ----------------------------------------------------

        if (!Array.isArray(data.flashcards)) {

            throw new Error(
                "Flashcards were not returned correctly."
            );
        }

        if (data.flashcards.length === 0) {

            throw new Error(
                "No flashcards were generated."
            );
        }

        flashcards = data.flashcards;

        currentCard = 0;
        isFlipped = false;

        console.log(
            "Flashcards generated:",
            flashcards
        );

        // ----------------------------------------------------
        // HIDE LOADING
        // ----------------------------------------------------

        if (loading) {
            loading.style.display = "none";
        }

        // ----------------------------------------------------
        // SHOW FLASHCARD AREA
        // ----------------------------------------------------

        if (area) {
            area.style.display = "block";
        }

        // ----------------------------------------------------
        // DISPLAY FIRST CARD
        // ----------------------------------------------------

        displayFlashcard();

        createCardDots();

        // ----------------------------------------------------
        // SCROLL TO FLASHCARDS
        // ----------------------------------------------------

        setTimeout(function () {

            if (area) {

                area.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

        }, 100);

    } catch (error) {

        console.error(
            "❌ FLASHCARD ERROR:",
            error
        );

        if (loading) {
            loading.style.display = "none";
        }

        if (errorBox) {

            errorBox.textContent =
                "❌ " +
                (
                    error.message ||
                    "Unable to generate flashcards."
                );

            errorBox.style.display = "block";
        }

    } finally {

        button.disabled = false;

        button.innerHTML =
            "<span>✨</span> Generate Cards <span>→</span>";
    }
}


// ============================================================
// DISPLAY FLASHCARD
// ============================================================

function displayFlashcard() {

    if (!flashcards.length) {
        return;
    }

    const card = flashcards[currentCard];

    if (!card) {
        return;
    }

    // IMPORTANT:
    // Your HTML uses cardFront and cardBack

    const front = getElement("cardFront");
    const back = getElement("cardBack");
    const cardElement = getElement("flashcard");

    // --------------------------------------------------------
    // FRONT
    // --------------------------------------------------------

    if (front) {

        front.textContent =
            card.front ||
            card.question ||
            "";
    }

    // --------------------------------------------------------
    // BACK
    // --------------------------------------------------------

    if (back) {

        back.textContent =
            card.back ||
            card.answer ||
            "";
    }

    // --------------------------------------------------------
    // RESET FLIP
    // --------------------------------------------------------

    if (cardElement) {

        cardElement.classList.remove(
            "flipped"
        );
    }

    isFlipped = false;

    // --------------------------------------------------------
    // UPDATE COUNTER
    // --------------------------------------------------------

    updateCardCounter();

    // --------------------------------------------------------
    // UPDATE DOTS
    // --------------------------------------------------------

    updateCardDots();
}


// ============================================================
// FLIP CARD
// ============================================================

function flipCard() {

    const card =
        getElement("flashcard");

    if (!card) {
        return;
    }

    isFlipped =
        !isFlipped;

    card.classList.toggle(
        "flipped",
        isFlipped
    );
}


// ============================================================
// NEXT CARD
// ============================================================

function nextCard() {

    if (!flashcards.length) {
        return;
    }

    currentCard++;

    if (
        currentCard >=
        flashcards.length
    ) {

        currentCard = 0;
    }

    displayFlashcard();
}


// ============================================================
// PREVIOUS CARD
// ============================================================

function previousCard() {

    if (!flashcards.length) {
        return;
    }

    currentCard--;

    if (currentCard < 0) {

        currentCard =
            flashcards.length - 1;
    }

    displayFlashcard();
}


// ============================================================
// CARD COUNTER
// ============================================================

function updateCardCounter() {

    const counter =
        getElement("cardCounter");

    if (!counter) {
        return;
    }

    counter.textContent =
        `${currentCard + 1} / ${flashcards.length}`;
}


// ============================================================
// CREATE CARD DOTS
// ============================================================

function createCardDots() {

    const container =
        getElement("cardDots");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    flashcards.forEach(
        function (_, index) {

            const dot =
                document.createElement("span");

            dot.className =
                "card-dot";

            if (
                index ===
                currentCard
            ) {

                dot.classList.add(
                    "active"
                );
            }

            dot.addEventListener(
                "click",
                function () {

                    currentCard =
                        index;

                    displayFlashcard();
                }
            );

            container.appendChild(dot);
        }
    );
}


// ============================================================
// UPDATE CARD DOTS
// ============================================================

function updateCardDots() {

    const dots =
        document.querySelectorAll(
            ".card-dot"
        );

    dots.forEach(
        function (dot, index) {

            dot.classList.toggle(
                "active",
                index === currentCard
            );
        }
    );
}


// ============================================================
// SETUP FLASHCARD PAGE
// ============================================================

function setupFlashcardPage() {

    const topicInput =
        getElement("flashcardTopic");

    const generateBtn =
        getElement("generateBtn");

    const flashcard =
        getElement("flashcard");

    const previousBtn =
        document.querySelector(
            ".card-controls .card-control:first-child"
        );

    const nextBtn =
        document.querySelector(
            ".card-controls .card-control:last-child"
        );

    const flipBtn =
        document.querySelector(
            ".flip-button"
        );

    // --------------------------------------------------------
    // GENERATE BUTTON
    // --------------------------------------------------------

    if (generateBtn) {

        generateBtn.addEventListener(
            "click",
            generateFlashcards
        );

        console.log(
            "✅ Flashcard generate button connected."
        );
    }

    // --------------------------------------------------------
    // ENTER KEY
    // --------------------------------------------------------

    if (topicInput) {

        topicInput.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    generateFlashcards();
                }
            }
        );
    }

    // --------------------------------------------------------
    // CARD CLICK
    // --------------------------------------------------------

    if (flashcard) {

        flashcard.addEventListener(
            "click",
            flipCard
        );
    }

    // --------------------------------------------------------
    // PREVIOUS
    // --------------------------------------------------------

    if (previousBtn) {

        previousBtn.addEventListener(
            "click",
            previousCard
        );
    }

    // --------------------------------------------------------
    // NEXT
    // --------------------------------------------------------

    if (nextBtn) {

        nextBtn.addEventListener(
            "click",
            nextCard
        );
    }

    // --------------------------------------------------------
    // FLIP BUTTON
    // --------------------------------------------------------

    if (flipBtn) {

        flipBtn.addEventListener(
            "click",
            flipCard
        );
    }

    console.log(
        "🃏 Flashcard page initialized."
    );
}


// ============================================================
// FLASHCARD KEYBOARD CONTROLS
// ============================================================

document.addEventListener(
    "keydown",
    function (event) {

        const activeElement =
            document.activeElement;

        const typing =
            activeElement &&
            (
                activeElement.tagName === "INPUT" ||
                activeElement.tagName === "TEXTAREA" ||
                activeElement.tagName === "SELECT"
            );

        if (typing) {
            return;
        }

        const area =
            getElement("flashcardArea");

        const visible =
            area &&
            area.style.display !== "none";

        if (!visible) {
            return;
        }

        if (
            event.key === "ArrowRight"
        ) {

            nextCard();
        }

        if (
            event.key === "ArrowLeft"
        ) {

            previousCard();
        }

        if (
            event.key === " "
        ) {

            event.preventDefault();

            flipCard();
        }
    }
);


// ============================================================
// INITIALIZE FLASHCARD PAGE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupFlashcardPage();

    }
);

// STUDYAI - EXPLAIN SECTION
// ============================================================

// IMPORTANT:
// Keep ONLY ONE copy of this section in script.js.
// Do not create another getElement(), explainTopic(),
// renderExplanation(), or setupExplainPage() elsewhere.


// ============================================================
// SAFE ELEMENT HELPER
// ============================================================

function getElement(id) {
    return document.getElementById(id);
}


// ============================================================
// GLOBAL EXPLAIN VARIABLES
// ============================================================

let currentExplanation = null;
let explanationRequestId = 0;


// ============================================================
// STOP ALL VOICE
// ============================================================

function stopSpeechSilently() {

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    if (typeof currentAudio !== "undefined" && currentAudio) {

        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = "";
        currentAudio = null;
    }
}


// ============================================================
// EXPLAIN TOPIC
// ============================================================

async function explainTopic() {

    console.log("🔥 explainTopic() called");

    const topicInput = getElement("topicInput");
    const explainBtn = getElement("explainBtn");
    const loading = getElement("loading");
    const result = getElement("result");
    const errorBox = getElement("error");

    // --------------------------------------------------------
    // CHECK ELEMENTS
    // --------------------------------------------------------

    if (!topicInput) {
        console.error("❌ topicInput not found");
        return;
    }

    if (!explainBtn) {
        console.error("❌ explainBtn not found");
        return;
    }

    const topic = topicInput.value.trim();

    // --------------------------------------------------------
    // EMPTY TOPIC
    // --------------------------------------------------------

    if (!topic) {

        if (errorBox) {

            errorBox.innerText =
                "⚠️ Please enter a topic first.";

            errorBox.style.display = "block";
        }

        topicInput.focus();

        return;
    }

    // --------------------------------------------------------
    // NEW REQUEST
    // --------------------------------------------------------

    explanationRequestId++;

    const requestId =
        explanationRequestId;

    // --------------------------------------------------------
    // STOP OLD VOICE
    // --------------------------------------------------------

    stopSpeechSilently();

    // --------------------------------------------------------
    // RESET UI
    // --------------------------------------------------------

    if (errorBox) {

        errorBox.innerText = "";

        errorBox.style.display = "none";
    }

    if (result) {
        result.style.display = "none";
    }

    if (loading) {
        loading.style.display = "block";
    }

    explainBtn.disabled = true;

    explainBtn.innerText =
        "🤖 Explaining...";

    // --------------------------------------------------------
    // CALL BACKEND
    // --------------------------------------------------------

    try {

        console.log(
            "📡 Sending topic:",
            topic
        );

        const response =
            await fetch(
                "/api/explain-topic",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        topic: topic
                    })
                }
            );

        console.log(
            "📡 Response status:",
            response.status
        );

        // ----------------------------------------------------
        // READ JSON
        // ----------------------------------------------------

        let data;

        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "Server returned an invalid response."
            );
        }

        console.log(
            "📦 Explain data:",
            data
        );

        // ----------------------------------------------------
        // API ERROR
        // ----------------------------------------------------

        if (
            !response.ok ||
            data.error
        ) {

            throw new Error(
                data.error ||
                "Unable to generate explanation."
            );
        }

        // ----------------------------------------------------
        // IGNORE OLD REQUEST
        // ----------------------------------------------------

        if (
            requestId !==
            explanationRequestId
        ) {

            console.log(
                "⚠️ Old explanation ignored."
            );

            return;
        }

        // ----------------------------------------------------
        // STORE DATA
        // ----------------------------------------------------

        currentExplanation = {

            title:
                data.title ||
                topic,

            simple_explanation:
                data.simple_explanation ||
                "",

            how_it_works:
                data.how_it_works ||
                "",

            important_points:
                Array.isArray(
                    data.important_points
                )
                    ? data.important_points
                    : [],

            example:
                data.example ||
                "",

            quick_revision:
                data.quick_revision ||
                ""
        };

        // ----------------------------------------------------
        // DISPLAY
        // ----------------------------------------------------

        renderExplanation(
            currentExplanation
        );

        if (loading) {
            loading.style.display = "none";
        }

        if (result) {

            result.style.display =
                "block";

            result.classList.remove(
                "result-visible"
            );

            requestAnimationFrame(
                function() {

                    result.classList.add(
                        "result-visible"
                    );

                }
            );
        }

        console.log(
            "✅ Explanation displayed."
        );

    } catch (error) {

        console.error(
            "❌ EXPLAIN ERROR:",
            error
        );

        if (loading) {
            loading.style.display = "none";
        }

        if (errorBox) {

            errorBox.innerText =
                "❌ " +
                (
                    error.message ||
                    "Unable to generate explanation."
                );

            errorBox.style.display =
                "block";
        }

    } finally {

        if (
            requestId ===
            explanationRequestId
        ) {

            explainBtn.disabled = false;

            explainBtn.innerText =
                "✨ Explain Topic →";
        }
    }
}


// ============================================================
// RENDER EXPLANATION
// ============================================================

function renderExplanation(data) {

    console.log(
        "🎨 Rendering explanation..."
    );

    if (!data) {
        return;
    }

    const title =
        getElement("resultTitle");

    const simple =
        getElement("simpleExplanation");

    const how =
        getElement("howItWorks");

    const points =
        getElement("importantPoints");

    const example =
        getElement("example");

    const revision =
        getElement("quickRevision");

    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    if (title) {

        title.innerText =
            data.title || "";
    }

    // --------------------------------------------------------
    // SIMPLE EXPLANATION
    // --------------------------------------------------------

    if (simple) {

        simple.innerText =
            data.simple_explanation || "";
    }

    // --------------------------------------------------------
    // HOW IT WORKS
    // --------------------------------------------------------

    if (how) {

        how.innerText =
            data.how_it_works || "";
    }

    // --------------------------------------------------------
    // IMPORTANT POINTS
    // --------------------------------------------------------

    if (points) {

        points.innerHTML = "";

        if (
            Array.isArray(
                data.important_points
            )
        ) {

            data.important_points.forEach(
                function(point, index) {

                    const li =
                        document.createElement(
                            "li"
                        );

                    li.innerText =
                        point;

                    li.style.animationDelay =
                        `${index * 0.12}s`;

                    points.appendChild(li);
                }
            );
        }
    }

    // --------------------------------------------------------
    // EXAMPLE
    // --------------------------------------------------------

    if (example) {

        example.innerText =
            data.example || "";
    }

    // --------------------------------------------------------
    // QUICK REVISION
    // --------------------------------------------------------

    if (revision) {

        revision.innerText =
            data.quick_revision || "";
    }
}


// ============================================================
// GET EXPLANATION TEXT
// ============================================================

function getExplanationText() {

    if (!currentExplanation) {
        return "";
    }

    const parts = [

        currentExplanation.title,

        currentExplanation.simple_explanation,

        currentExplanation.how_it_works,

        Array.isArray(
            currentExplanation.important_points
        )
            ? currentExplanation
                .important_points
                .join(". ")
            : "",

        currentExplanation.example,

        currentExplanation.quick_revision

    ];

    return parts
        .filter(function(text) {

            return (
                typeof text === "string" &&
                text.trim().length > 0
            );

        })
        .join(". ");
}


// ============================================================
// CLEAR EXPLANATION
// ============================================================

function clearExplanationData() {

    stopSpeechSilently();

    currentExplanation = null;

    const ids = [

        "resultTitle",
        "simpleExplanation",
        "howItWorks",
        "example",
        "quickRevision",
        "voiceStatus"

    ];

    ids.forEach(function(id) {

        const element =
            getElement(id);

        if (element) {
            element.innerText = "";
        }

    });

    const points =
        getElement("importantPoints");

    if (points) {
        points.innerHTML = "";
    }
}


// ============================================================
// NEW TOPIC
// ============================================================

function newTopic() {

    explanationRequestId++;

    stopSpeechSilently();

    clearExplanationData();

    const topicInput =
        getElement("topicInput");

    const result =
        getElement("result");

    const loading =
        getElement("loading");

    const errorBox =
        getElement("error");

    if (topicInput) {

        topicInput.value = "";

        topicInput.focus();
    }

    if (result) {
        result.style.display = "none";
    }

    if (loading) {
        loading.style.display = "none";
    }

    if (errorBox) {

        errorBox.innerText = "";

        errorBox.style.display = "none";
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================================
// ENGLISH VOICE
// ============================================================

function speakEnglishText(text) {

    const status =
        getElement("voiceStatus");

    if (!text || !text.trim()) {

        if (status) {
            status.innerText =
                "⚠️ Please generate an explanation first.";
        }

        return;
    }

    stopSpeechSilently();

    if (status) {
        status.innerText =
            "🔊 Speaking in English...";
    }

    const speech =
        new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";

    speech.rate = 0.9;

    speech.pitch = 1;

    speech.volume = 1;

    const voices =
        window.speechSynthesis.getVoices();

    let englishVoice =
        voices.find(function(voice) {

            return (
                voice.lang &&
                voice.lang
                    .toLowerCase()
                    .startsWith("en-in")
            );

        });

    if (!englishVoice) {

        englishVoice =
            voices.find(function(voice) {

                return (
                    voice.lang &&
                    voice.lang
                        .toLowerCase()
                        .startsWith("en")
                );

            });
    }

    if (englishVoice) {

        speech.voice =
            englishVoice;

        speech.lang =
            englishVoice.lang;
    }

    speech.onend =
        function() {

            if (status) {

                status.innerText =
                    "✓ English explanation finished.";
            }
        };

    speech.onerror =
        function(event) {

            console.error(
                "English speech error:",
                event.error
            );

            if (status) {

                status.innerText =
                    "⚠️ English voice error.";
            }
        };

    window.speechSynthesis.speak(
        speech
    );
}


// ============================================================
// VOICE CONTROLLER
// ============================================================

function speakExplanation(language) {

    const text =
        getExplanationText();

    if (!text) {

        const status =
            getElement("voiceStatus");

        if (status) {

            status.innerText =
                "⚠️ Please generate an explanation first.";
        }

        return;
    }

    if (
        language === "en-IN"
    ) {

        speakEnglishText(text);

        return;
    }

    // Telugu function can be supplied by your
    // existing Telugu section.

    if (
        language === "te-IN" &&
        typeof speakTeluguText === "function"
    ) {

        speakTeluguText();

        return;
    }
}


// ============================================================
// STOP VOICE
// ============================================================

function stopSpeaking() {

    stopSpeechSilently();

    const status =
        getElement("voiceStatus");

    if (status) {

        status.innerText =
            "⏹ Voice stopped.";
    }
}


// ============================================================
// EXPLAIN PAGE SETUP
// ============================================================

function setupExplainPage() {

    console.log(
        "🔧 Setting up Explain page..."
    );

    const explainBtn =
        getElement("explainBtn");

    const topicInput =
        getElement("topicInput");

    const englishBtn =
        getElement("englishVoiceBtn");

    const teluguBtn =
    getElement("teluguVoiceBtn");

if (teluguBtn) {

    teluguBtn.onclick =
        function() {

            speakExplanation("te-IN");

        };

    console.log(
        "✅ Telugu button connected."
    );
}

    const stopBtn =
        getElement("stopVoiceBtn");

    const newTopicBtn =
        getElement("newTopicBtn");

    // --------------------------------------------------------
    // EXPLAIN BUTTON
    // --------------------------------------------------------

    if (explainBtn) {

        // Prevent duplicate listeners
        explainBtn.onclick =
            explainTopic;

        console.log(
            "✅ Explain button connected."
        );
    }

    // --------------------------------------------------------
    // ENTER KEY
    // --------------------------------------------------------

    if (topicInput) {

        topicInput.onkeydown =
            function(event) {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    explainTopic();
                }
            };
    }

    // --------------------------------------------------------
    // ENGLISH
    // --------------------------------------------------------

    if (englishBtn) {

        englishBtn.onclick =
            function() {

                speakExplanation(
                    "en-IN"
                );

            };
    }

   // ============================================================
// TELUGU VOICE
// ============================================================

async function speakTeluguText() {

    if (!currentExplanation) {

        alert("Please explain a topic first.");
        return;
    }

    const status =
        document.getElementById("voiceStatus");

    const btn =
        document.getElementById("teluguVoiceBtn");

    try {

        if (typeof stopSpeechSilently === "function") {
            stopSpeechSilently();
        }

        if (status) {
            status.textContent =
                "🔄 Preparing Telugu voice...";
        }

        if (btn) {
            btn.disabled = true;
        }

        const englishText =
            getExplanationText();

        if (!englishText) {

            throw new Error(
                "No explanation available."
            );
        }


        // ==========================================
        // ONE REQUEST
        // ==========================================

        const response =
            await fetch(
                "/api/fast-telugu-voice",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        text: englishText
                    })
                }
            );


        // ==========================================
        // READ RESPONSE
        // ==========================================

        const data =
            await response.json();


        if (
            !response.ok ||
            !data.audio
        ) {

            throw new Error(
                data.error ||
                "Telugu voice generation failed."
            );
        }


        console.log(
            "Telugu audio received."
        );


        if (status) {
            status.textContent =
                "🔊 Speaking Telugu...";
        }


        // ==========================================
        // BASE64 → BYTES
        // ==========================================

        const binary =
            atob(data.audio);

        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {

            bytes[i] =
                binary.charCodeAt(i);
        }


        // ==========================================
        // WAV
        // ==========================================

        const blob =
            new Blob(
                [bytes],
                {
                    type: "audio/wav"
                }
            );


        const audioURL =
            URL.createObjectURL(
                blob
            );


        const audio =
            new Audio(
                audioURL
            );


        currentAudio =
            audio;


        // ==========================================
        // PLAY
        // ==========================================

        audio.onended =
            function() {

                if (
                    currentAudio ===
                    audio
                ) {

                    currentAudio = null;
                }

                if (status) {

                    status.textContent =
                        "✓ Telugu voice finished.";
                }

                URL.revokeObjectURL(
                    audioURL
                );
            };


        audio.onerror =
            function(event) {

                console.error(
                    "Telugu audio playback error:",
                    event
                );

                if (
                    currentAudio ===
                    audio
                ) {

                    currentAudio = null;
                }

                if (status) {

                    status.textContent =
                        "❌ Could not play Telugu audio.";
                }

                URL.revokeObjectURL(
                    audioURL
                );
            };


        await audio.play();


    } catch (error) {

        console.error(
            "TELUGU VOICE ERROR:",
            error
        );

        if (status) {

            status.textContent =
                "❌ Telugu voice error: " +
                error.message;
        }

    } finally {

        if (btn) {
            btn.disabled = false;
        }
    }
}

// ============================================================
// PCM → WAV CONVERTER
// ============================================================

function createWavFromPCM(
    pcmData,
    sampleRate = 24000,
    channels = 1,
    bitsPerSample = 16
) {

    const byteRate =
        sampleRate *
        channels *
        bitsPerSample /
        8;

    const blockAlign =
        channels *
        bitsPerSample /
        8;

    const buffer =
        new ArrayBuffer(
            44 + pcmData.length
        );

    const view =
        new DataView(buffer);


    // --------------------------------------------------------
    // WRITE STRING
    // --------------------------------------------------------

    function writeString(
        offset,
        string
    ) {

        for (
            let i = 0;
            i < string.length;
            i++
        ) {

            view.setUint8(
                offset + i,
                string.charCodeAt(i)
            );
        }
    }


    // --------------------------------------------------------
    // WAV HEADER
    // --------------------------------------------------------

    writeString(
        0,
        "RIFF"
    );

    view.setUint32(
        4,
        36 + pcmData.length,
        true
    );

    writeString(
        8,
        "WAVE"
    );

    writeString(
        12,
        "fmt "
    );

    view.setUint32(
        16,
        16,
        true
    );

    // PCM
    view.setUint16(
        20,
        1,
        true
    );

    // Channels
    view.setUint16(
        22,
        channels,
        true
    );

    // Sample rate
    view.setUint32(
        24,
        sampleRate,
        true
    );

    // Byte rate
    view.setUint32(
        28,
        byteRate,
        true
    );

    // Block align
    view.setUint16(
        32,
        blockAlign,
        true
    );

    // Bits per sample
    view.setUint16(
        34,
        bitsPerSample,
        true
    );

    writeString(
        36,
        "data"
    );

    view.setUint32(
        40,
        pcmData.length,
        true
    );


    // --------------------------------------------------------
    // COPY PCM DATA
    // --------------------------------------------------------

    const output =
        new Uint8Array(buffer);

    output.set(
        pcmData,
        44
    );

    return buffer;
}
// ============================================================
// VOICE CONTROLLER
// ============================================================

function speakExplanation(language) {

    console.log(
        "🎤 Voice requested:",
        language
    );


    // --------------------------------------------------------
    // ENGLISH
    // --------------------------------------------------------

    if (
        language === "en-IN"
    ) {

        const text =
            getExplanationText();


        if (!text) {

            const status =
                getElement("voiceStatus");

            if (status) {

                status.innerText =
                    "⚠️ Please generate an explanation first.";
            }

            return;
        }


        speakEnglishText(text);

        return;
    }


    // --------------------------------------------------------
    // TELUGU
    // --------------------------------------------------------

    if (
        language === "te-IN"
    ) {

        speakTeluguText();

        return;
    }


    console.error(
        "❌ Unknown voice language:",
        language
    );
}


// ============================================================
// STOP VOICE
// ============================================================

function stopSpeaking() {

    stopSpeechSilently();


    const status =
        getElement("voiceStatus");


    if (status) {

        status.innerText =
            "⏹ Voice stopped.";
    }
}
    // --------------------------------------------------------
    // STOP
    // --------------------------------------------------------

    if (stopBtn) {

        stopBtn.onclick =
            stopSpeaking;
    }

    // --------------------------------------------------------
    // NEW TOPIC
    // --------------------------------------------------------

    if (newTopicBtn) {

        newTopicBtn.onclick =
            newTopic;
    }

    console.log(
        "✅ Explain page initialized."
    );
}


// ============================================================
// AUTO INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        setupExplainPage();

        console.log(
            "🚀 Explain page ready."
        );

    }
);



// ============================================================
// STUDY PLANNER
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    const plannerButton =
        document.getElementById("plannerGenerateBtn");

    const subjectInput =
        document.getElementById("plannerSubject");

    const topicsInput =
        document.getElementById("plannerTopics");

    const examDateInput =
        document.getElementById("plannerExamDate");

    const hoursInput =
        document.getElementById("plannerHours");

    const loading =
        document.getElementById("plannerLoading");

    const errorBox =
        document.getElementById("plannerError");

    const result =
        document.getElementById("plannerResult");

    const summary =
        document.getElementById("plannerSummary");

    const cards =
        document.getElementById("plannerCards");

    const title =
        document.getElementById("plannerTitle");

    const restart =
        document.getElementById("plannerRestartBtn");


    // Check that button exists
    if (!plannerButton) {
        console.error("Study Planner: Generate button not found.");
        return;
    }


    plannerButton.addEventListener(
        "click",
        generateStudyPlan
    );


    async function generateStudyPlan() {

        const subject =
            subjectInput ? subjectInput.value.trim() : "";

        const topics =
            topicsInput ? topicsInput.value.trim() : "";

        const examDate =
            examDateInput ? examDateInput.value : "";

        const hours =
            hoursInput ? hoursInput.value : "2";


        console.log("PLANNER BUTTON CLICKED");

        console.log({
            subject,
            topics,
            examDate,
            hours
        });


        // Validation

        if (!subject) {

            showPlannerError(
                "Please enter the subject."
            );

            if (subjectInput) {
                subjectInput.focus();
            }

            return;
        }


        if (!topics) {

            showPlannerError(
                "Please enter the main topics."
            );

            if (topicsInput) {
                topicsInput.focus();
            }

            return;
        }


        if (!examDate) {

            showPlannerError(
                "Please select your exam date."
            );

            if (examDateInput) {
                examDateInput.focus();
            }

            return;
        }


        // Show loading

        if (errorBox) {
            errorBox.style.display = "none";
            errorBox.textContent = "";
        }

        if (result) {
            result.style.display = "none";
        }

        if (loading) {
            loading.style.display = "block";
        }

        plannerButton.disabled = true;


        try {

            const response = await fetch(
                "/api/generate-study-plan",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        subject: subject,

                        topics: topics,

                        exam_date: examDate,

                        hours_per_day:
                            Number(hours)

                    })
                }
            );


            console.log(
                "Planner response status:",
                response.status
            );


            // Get response safely

            const rawText =
                await response.text();

            console.log(
                "Planner raw response:",
                rawText
            );


            let data;


            try {

                data =
                    JSON.parse(rawText);

            }

            catch (jsonError) {

                throw new Error(
                    "Server returned invalid JSON."
                );

            }


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Failed to generate study plan."
                );

            }


            if (data.error) {

                throw new Error(
                    data.error
                );

            }


            // Accept common response names

            const plan =
                data.plan ||
                data.study_plan ||
                data.daily_plan ||
                data.days;


            if (
                !plan ||
                !Array.isArray(plan) ||
                plan.length === 0
            ) {

                throw new Error(
                    "No daily study plan was returned."
                );

            }


            // Hide loading

            if (loading) {
                loading.style.display = "none";
            }


            // Show result

            if (result) {
                result.style.display = "block";
            }


            // Title

            if (title) {

                title.textContent =
                    subject + " Study Plan";

            }


            // Summary

            if (summary) {

                summary.innerHTML = `

                    <div class="quiz-generator-heading">

                        <div class="quiz-generator-icon">
                            🎯
                        </div>

                        <div>

                            <h2>
                                Your Personalized Plan
                            </h2>

                            <p>
                                ${plan.length} study days
                                • ${hours} hour(s) per day
                            </p>

                        </div>

                    </div>

                `;

            }


            // Daily cards

            if (cards) {

                cards.innerHTML = "";

                plan.forEach(
                    (day, index) => {

                        const card =
                            document.createElement(
                                "div"
                            );

                        card.className =
                            "question-card planner-day-card";


                        const dayNumber =
                            day.day ||
                            day.day_number ||
                            (index + 1);


                        const dateText =
                            day.date ||
                            day.study_date ||
                            "";


                        const mainTopic =
                            day.main_topic ||
                            day.mainTopic ||
                            day.topic ||
                            "Study";


                        const focusedTopic =
                            day.focused_topic ||
                            day.focusedTopic ||
                            day.focus ||
                            "Revision";


                        const amount =
                            day.study_amount ||
                            day.studyAmount ||
                            day.duration ||
                            day.hours ||
                            hours + " hour(s)";


                        card.innerHTML = `

                            <div class="question-card-top">

                                <span>
                                    DAY ${dayNumber}
                                    ${dateText
                                        ? " • " + dateText
                                        : ""}
                                </span>

                                <span class="question-star">
                                    ✦
                                </span>

                            </div>


                            <div class="question-content">

                                <div class="question-icon">
                                    📚
                                </div>

                                <div>

                                    <h2>
                                        ${mainTopic}
                                    </h2>

                                    <p>
                                        Focused Topic:
                                        <strong>
                                            ${focusedTopic}
                                        </strong>
                                    </p>

                                </div>

                            </div>


                            <div class="quiz-feedback"
                                 style="display:block;">

                                ⏱️ Study Amount:
                                <strong>
                                    ${amount}
                                </strong>

                            </div>

                        `;


                        cards.appendChild(
                            card
                        );

                    }
                );

            }


            // Scroll to result

            if (result) {

                result.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

        }

        catch (error) {

            console.error(
                "STUDY PLAN ERROR:",
                error
            );


            if (loading) {
                loading.style.display = "none";
            }


            showPlannerError(
                "❌ " + error.message
            );

        }

        finally {

            plannerButton.disabled =
                false;

        }

    }


    function showPlannerError(message) {

        if (!errorBox) {

            alert(message);

            return;

        }


        errorBox.textContent =
            message;

        errorBox.style.display =
            "block";

    }


    // Restart button

    if (restart) {

        restart.addEventListener(
            "click",
            function () {

                if (result) {
                    result.style.display = "none";
                }

                if (errorBox) {
                    errorBox.style.display = "none";
                }

                if (subjectInput) {
                    subjectInput.focus();
                }

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }

});