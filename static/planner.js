document.addEventListener("DOMContentLoaded", function () {

    const generateBtn = document.getElementById("plannerGenerateBtn");

    const subjectInput = document.getElementById("plannerSubject");
    const topicsInput = document.getElementById("plannerTopics");
    const examDateInput = document.getElementById("plannerExamDate");
    const hoursInput = document.getElementById("plannerHours");

    const loading = document.getElementById("plannerLoading");
    const errorBox = document.getElementById("plannerError");
    const result = document.getElementById("plannerResult");

    const plannerSummary = document.getElementById("plannerSummary");
    const plannerCards = document.getElementById("plannerCards");

    const restartBtn = document.getElementById("plannerRestartBtn");


    // ==========================================
    // CHECK ELEMENTS
    // ==========================================

    if (!generateBtn) {
        console.error("plannerGenerateBtn not found.");
        return;
    }

    if (!subjectInput) {
        console.error("plannerSubject not found.");
        return;
    }

    if (!topicsInput) {
        console.error("plannerTopics not found.");
        return;
    }

    if (!examDateInput) {
        console.error("plannerExamDate not found.");
        return;
    }


    // ==========================================
    // GENERATE BUTTON
    // ==========================================

    generateBtn.addEventListener("click", generatePlan);


    async function generatePlan() {

        const subject = subjectInput.value.trim();
        const topics = topicsInput.value.trim();
        const examDate = examDateInput.value;
        const hours = Number(hoursInput.value);


        // ======================================
        // VALIDATION
        // ======================================

        if (!subject) {
            showError("Please enter the subject.");
            subjectInput.focus();
            return;
        }

        if (!topics) {
            showError("Please enter the topics.");
            topicsInput.focus();
            return;
        }

        if (!examDate) {
            showError("Please select your exam date.");
            examDateInput.focus();
            return;
        }


        // ======================================
        // RESET
        // ======================================

        errorBox.style.display = "none";
        result.style.display = "none";

        loading.style.display = "block";

        generateBtn.disabled = true;


        try {

            console.log("Generating study plan...");

            console.log({
                subject,
                topics,
                examDate,
                hours
            });


            // ==================================
            // API REQUEST
            // ==================================

            const response = await fetch(
                "/api/generate-study-plan",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        subject: subject,
                        topics: topics,
                        exam_date: examDate,
                        hours_per_day: hours
                    })
                }
            );


            // ==================================
            // READ RESPONSE
            // ==================================

            const rawText = await response.text();

            console.log("SERVER RESPONSE:", rawText);


            let data;

            try {

                data = JSON.parse(rawText);

            } catch (error) {

                throw new Error(
                    "Server returned invalid JSON."
                );

            }


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Could not generate study plan."
                );

            }


            if (data.error) {

                throw new Error(data.error);

            }


            if (
                !data.plan ||
                !Array.isArray(data.plan) ||
                data.plan.length === 0
            ) {

                throw new Error(
                    "No daily study plan was returned."
                );

            }


            // ==================================
            // DISPLAY
            // ==================================

            loading.style.display = "none";

            

            displaySummary(
                subject,
                examDate,
                hours,
                data.plan
            );


            displayDailyPlan(
                data.plan,
                hours
            );


            result.style.display = "block";


            result.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });


        } catch (error) {

            console.error(
                "STUDY PLANNER ERROR:",
                error
            );

            loading.style.display = "none";

            showError(
                error.message ||
                "Something went wrong."
            );

        } finally {

            generateBtn.disabled = false;

        }

    }


    // ==========================================
    // SUMMARY
    // ==========================================

    function displaySummary(
        subject,
        examDate,
        hours,
        plan
    ) {

        plannerSummary.innerHTML = `

            <div class="planner-summary-grid">

                <div class="planner-summary-item">

                    <span class="planner-summary-icon">
                        📚
                    </span>

                    <div>

                        <small>
                            SUBJECT
                        </small>

                        <strong>
                            ${escapeHTML(subject)}
                        </strong>

                    </div>

                </div>


                <div class="planner-summary-item">

                    <span class="planner-summary-icon">
                        🎯
                    </span>

                    <div>

                        <small>
                            EXAM DATE
                        </small>

                        <strong>
                            ${formatDate(examDate)}
                        </strong>

                    </div>

                </div>


                <div class="planner-summary-item">

                    <span class="planner-summary-icon">
                        📅
                    </span>

                    <div>

                        <small>
                            STUDY DAYS
                        </small>

                        <strong>
                            ${plan.length} days
                        </strong>

                    </div>

                </div>

            </div>

        `;

    }


    // ==========================================
    // DAILY PLAN
    // ==========================================

    function displayDailyPlan(plan, hours) {

        plannerCards.innerHTML = "";


        // ======================================
        // SECTION HEADER
        // ======================================

        const header =
            document.createElement("div");

        header.className =
            "planner-section-heading";

        header.innerHTML = `

            <div>

                <h2>
                    Your Daily Study Plan
                </h2>

                <p>
                    Follow one focused goal each day.
                </p>

            </div>

        `;

        plannerCards.appendChild(header);


        // ======================================
        // CARDS
        // ======================================

        plan.forEach((day, index) => {

            const card =
                document.createElement("div");

            card.className =
                "planner-day-card";


            const dayNumber =
                day.day ||
                index + 1;


            const mainTopic =
                day.main_topic ||
                day.mainTopic ||
                day.topic ||
                "Study Topic";


            const focusedTopic =
                day.focused_topic ||
                day.focusedTopic ||
                day.focus ||
                "Focused Topic";


            const amount =
                day.amount_to_study ||
                day.amountToStudy ||
                day.study_amount ||
                day.studyAmount ||
                day.amount ||
                `${hours} hour${hours === 1 ? "" : "s"}`;


            card.innerHTML = `

                <div class="planner-day-left">

                    <div class="planner-day-badge">

                        <span>
                            DAY
                        </span>

                        <strong>
                            ${escapeHTML(dayNumber)}
                        </strong>

                    </div>

                </div>


                <div class="planner-day-middle">

                    <span class="planner-label">
                        MAIN TOPIC
                    </span>

                    <h3>
                        ${escapeHTML(mainTopic)}
                    </h3>


                    <div class="planner-focused">

                        <span>
                            🎯
                        </span>

                        <div>

                            <small>
                                FOCUSED TOPIC
                            </small>

                            <p>
                                ${escapeHTML(focusedTopic)}
                            </p>

                        </div>

                    </div>

                </div>


                <div class="planner-amount">

                    <span>
                        ⏱️
                    </span>

                    <div>

                        <small>
                            AMOUNT TO STUDY
                        </small>

                        <strong>
                            ${escapeHTML(String(amount))}
                        </strong>

                    </div>

                </div>

            `;


            plannerCards.appendChild(card);


            // ==================================
            // ANIMATION
            // ==================================

            card.style.opacity = "0";
            card.style.transform =
                "translateY(25px)";


            setTimeout(() => {

                card.style.transition =
                    "opacity 0.5s ease, transform 0.5s ease";

                card.style.opacity = "1";

                card.style.transform =
                    "translateY(0)";

            }, index * 100);

        });

    }


    // ==========================================
    // ERROR
    // ==========================================

    function showError(message) {

        loading.style.display = "none";

        errorBox.textContent =
            "❌ " + message;

        errorBox.style.display =
            "block";

    }


// ==========================================
// CREATE ANOTHER PLAN
// ==========================================

document.addEventListener("click", function (event) {

    const button = event.target.closest("#plannerRestartBtn");

    if (!button) {
        return;
    }

    event.preventDefault();

    console.log("✅ CREATE ANOTHER PLAN CLICKED");

    // Get elements again
    const result = document.getElementById("plannerResult");
    const builder = document.querySelector(".planner-builder");
    const loading = document.getElementById("plannerLoading");
    const errorBox = document.getElementById("plannerError");

    const subject = document.getElementById("plannerSubject");
    const topics = document.getElementById("plannerTopics");
    const examDate = document.getElementById("plannerExamDate");
    const hours = document.getElementById("plannerHours");

    const generateBtn =
        document.getElementById("plannerGenerateBtn");

    const plannerCards =
        document.getElementById("plannerCards");

    const plannerSummary =
        document.getElementById("plannerSummary");


    // ------------------------------------------
    // HIDE OLD RESULT
    // ------------------------------------------

    if (result) {
        result.style.display = "none";
    }


    // ------------------------------------------
    // SHOW BUILDER
    // ------------------------------------------

    if (builder) {
        builder.style.display = "block";
    }


    // ------------------------------------------
    // HIDE LOADING
    // ------------------------------------------

    if (loading) {
        loading.style.display = "none";
    }


    // ------------------------------------------
    // HIDE ERROR
    // ------------------------------------------

    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }


    // ------------------------------------------
    // CLEAR OLD RESULT
    // ------------------------------------------

    if (plannerCards) {
        plannerCards.innerHTML = "";
    }

    if (plannerSummary) {
        plannerSummary.innerHTML = "";
    }


    // ------------------------------------------
    // CLEAR INPUTS
    // ------------------------------------------

    if (subject) {
        subject.value = "";
    }

    if (topics) {
        topics.value = "";
    }

    if (examDate) {
        examDate.value = "";
    }

    if (hours) {
        hours.value = "2";
    }


    // ------------------------------------------
    // RESET GENERATE BUTTON
    // ------------------------------------------

    if (generateBtn) {

        generateBtn.disabled = false;

        generateBtn.textContent =
            "✨ Generate My Study Plan →";

        generateBtn.style.opacity = "1";

        generateBtn.style.pointerEvents = "auto";
    }


    // ------------------------------------------
    // GO BACK TO TOP
    // ------------------------------------------

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    // ------------------------------------------
    // FOCUS SUBJECT
    // ------------------------------------------

    setTimeout(function () {

        if (subject) {
            subject.focus();
        }

    }, 500);

});
    // ==========================================
    // SECURITY
    // ==========================================

    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

});