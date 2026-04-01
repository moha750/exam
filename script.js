// =================== State ===================
let examData = null;
let selectedQuestions = [];
let currentIndex = 0;
let userAnswers = {};       // { questionId: selectedOptionText }
let answeredStatus = {};    // { questionId: 'correct' | 'wrong' }
let correctCount = 0;
let wrongCount = 0;

// =================== DOM Helpers ===================
const $ = (id) => document.getElementById(id);

// =================== Screen Management ===================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
}

// =================== Shuffle (Fisher-Yates) ===================
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// =================== Load Exam ===================
async function loadExam() {
    showScreen('loading-screen');
    try {
        const response = await fetch('exam.json');
        if (!response.ok) throw new Error('لم يتم العثور على ملف exam.json');
        examData = await response.json();

        if (!examData.questions || !Array.isArray(examData.questions) || examData.questions.length === 0) {
            throw new Error('ملف الاختبار لا يحتوي على أسئلة صالحة');
        }

        // Update UI
        const title = examData.course_title || 'اختبار';
        $('app-title').textContent = title;
        $('exam-title').textContent = title;
        document.title = title;
        $('total-count').textContent = examData.questions.length;

        // Setup slider
        const slider = $('question-slider');
        const defaultVal = Math.min(10, examData.questions.length);
        slider.max = examData.questions.length;
        slider.value = defaultVal;
        $('slider-display').textContent = defaultVal;

        showScreen('welcome-screen');
    } catch (err) {
        $('error-message').textContent = err.message;
        showScreen('error-screen');
    }
}

// =================== Start Exam ===================
function startExam() {
    const count = parseInt($('question-slider').value);
    if (isNaN(count) || count < 1 || count > examData.questions.length) return;

    selectedQuestions = shuffleArray(examData.questions).slice(0, count);
    selectedQuestions.forEach(q => delete q._shuffledOptions);
    currentIndex = 0;
    userAnswers = {};
    answeredStatus = {};
    correctCount = 0;
    wrongCount = 0;
    updateCounter();
    showScreen('quiz-screen');
    renderQuestion();
}

// =================== Update Counter ===================
function updateCounter() {
    $('correct-count').textContent = correctCount;
    $('wrong-count').textContent = wrongCount;
    const answered = correctCount + wrongCount;
    $('remaining-count').textContent = selectedQuestions.length - answered;
}

// =================== Render Question ===================
function renderQuestion() {
    const q = selectedQuestions[currentIndex];
    const total = selectedQuestions.length;
    const isAnswered = answeredStatus[q.id] !== undefined;

    // Counter & topic
    $('question-counter').textContent = `سؤال ${currentIndex + 1} من ${total}`;
    $('question-topic').textContent = q.topic || '';
    $('question-text').textContent = q.question;

    // Progress bar
    $('progress-bar').style.width = ((currentIndex + 1) / total) * 100 + '%';

    // Shuffle options (only once per question)
    if (!q._shuffledOptions) {
        q._shuffledOptions = shuffleArray(q.options);
    }

    // Render options
    const container = $('options-container');
    container.innerHTML = '';
    q._shuffledOptions.forEach(optionText => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = optionText;

        if (isAnswered) {
            // Already answered - show feedback state
            btn.disabled = true;
            if (optionText === q.answer) {
                btn.classList.add('correct');
            }
            if (optionText === userAnswers[q.id] && optionText !== q.answer) {
                btn.classList.add('wrong');
            }
        } else {
            btn.addEventListener('click', () => selectOption(q.id, optionText, q.answer));
        }

        container.appendChild(btn);
    });

    // Hint - hide/reset
    $('hint-container').style.display = 'none';
    $('hint-btn').disabled = false;

    // Feedback
    if (isAnswered) {
        showFeedback(answeredStatus[q.id], q.answer);
        $('hint-btn').style.display = 'none';
    } else {
        $('feedback-container').style.display = 'none';
        $('hint-btn').style.display = '';
    }

    // Navigation buttons
    $('prev-btn').disabled = currentIndex === 0;
    const nextBtn = $('next-btn');
    if (currentIndex === total - 1) {
        nextBtn.textContent = 'إنهاء الاختبار';
        nextBtn.className = 'btn btn-success';
    } else {
        nextBtn.textContent = 'التالي';
        nextBtn.className = 'btn btn-primary';
    }
}

// =================== Select Option (with instant feedback) ===================
function selectOption(questionId, optionText, correctAnswer) {
    // Prevent re-answering
    if (answeredStatus[questionId] !== undefined) return;

    userAnswers[questionId] = optionText;
    const isCorrect = optionText === correctAnswer;

    if (isCorrect) {
        answeredStatus[questionId] = 'correct';
        correctCount++;
    } else {
        answeredStatus[questionId] = 'wrong';
        wrongCount++;
    }

    updateCounter();

    // Update option buttons visually
    const buttons = $('options-container').querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        }
        if (btn.textContent === optionText && !isCorrect) {
            btn.classList.add('wrong');
        }
    });

    // Show feedback
    showFeedback(isCorrect ? 'correct' : 'wrong', correctAnswer);

    // Hide hint button after answering
    $('hint-btn').style.display = 'none';
}

// =================== Show Feedback ===================
function showFeedback(status, correctAnswer) {
    const feedbackContainer = $('feedback-container');
    const feedbackBox = $('feedback-box');
    const feedbackText = $('feedback-text');

    feedbackContainer.style.display = 'block';
    feedbackBox.className = 'feedback-box ' + (status === 'correct' ? 'feedback-correct' : 'feedback-wrong');

    if (status === 'correct') {
        feedbackText.textContent = 'إجابة صحيحة!';
    } else {
        feedbackText.innerHTML = 'إجابة خاطئة! الإجابة الصحيحة: <strong>' + correctAnswer + '</strong>';
    }
}

// =================== Hint ===================
function showHint() {
    const q = selectedQuestions[currentIndex];
    if (!q.explanation) return;

    const cleanExplanation = q.explanation.replace(/\[cite:\s*[\d,\s]+\]/g, '');
    $('hint-text').textContent = cleanExplanation;
    $('hint-container').style.display = 'block';
    $('hint-btn').disabled = true;
}

// =================== Finish Exam ===================
function finishExam() {
    const unanswered = selectedQuestions.filter(q => answeredStatus[q.id] === undefined).length;
    if (unanswered > 0) {
        if (!confirm(`لديك ${unanswered} ${unanswered === 1 ? 'سؤال' : 'أسئلة'} بدون إجابة.\nهل تريد إنهاء الاختبار؟`)) {
            return;
        }
    }

    const total = selectedQuestions.length;
    const percentage = Math.round((correctCount / total) * 100);

    $('score-value').textContent = percentage + '%';
    $('score-text').textContent = `${correctCount} من ${total} إجابة صحيحة`;

    const circle = $('score-circle');
    circle.classList.remove('pass', 'fail');
    circle.classList.add(percentage >= 60 ? 'pass' : 'fail');

    $('review-container').style.display = 'none';
    $('review-container').innerHTML = '';
    reviewRendered = false;

    showScreen('results-screen');
}

// =================== Review ===================
let reviewRendered = false;

function toggleReview() {
    const container = $('review-container');
    if (container.style.display === 'none') {
        if (!reviewRendered) {
            renderReview();
            reviewRendered = true;
        }
        container.style.display = 'block';
        $('review-btn').textContent = 'إخفاء المراجعة';
        container.scrollIntoView({ behavior: 'smooth' });
    } else {
        container.style.display = 'none';
        $('review-btn').textContent = 'مراجعة الإجابات';
    }
}

function renderReview() {
    const container = $('review-container');
    let html = '';

    selectedQuestions.forEach((q, i) => {
        const userAnswer = userAnswers[q.id];
        const status = answeredStatus[q.id];
        const isUnanswered = status === undefined;

        let statusClass = 'is-correct';
        if (isUnanswered) statusClass = 'is-unanswered';
        else if (status === 'wrong') statusClass = 'is-wrong';

        html += `<div class="review-item ${statusClass}">`;
        html += `<div class="review-question-number">سؤال ${i + 1} - ${q.topic || ''}</div>`;
        html += `<div class="review-question-text">${q.question}</div>`;

        if (isUnanswered) {
            html += `<p class="unanswered-label">لم يتم الإجابة</p>`;
        }

        html += `<div class="review-options">`;
        q.options.forEach(opt => {
            let cls = '';
            let icon = '';
            if (opt === q.answer) {
                cls = 'correct';
                icon = ' &#10004;';
            }
            if (opt === userAnswer && status === 'wrong') {
                cls = 'wrong';
                icon = ' &#10008;';
            }
            html += `<div class="review-option ${cls}">${opt}${icon}</div>`;
        });
        html += `</div>`;

        if (q.explanation) {
            const cleanExplanation = q.explanation.replace(/\[cite:\s*[\d,\s]+\]/g, '');
            html += `<div class="explanation-box"><strong>الشرح:</strong>${cleanExplanation}</div>`;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

// =================== Retry ===================
function retryExam() {
    if (examData && examData.questions) {
        examData.questions.forEach(q => delete q._shuffledOptions);
    }
    currentIndex = 0;
    userAnswers = {};
    answeredStatus = {};
    correctCount = 0;
    wrongCount = 0;
    showScreen('welcome-screen');
}

// =================== Event Listeners ===================
document.addEventListener('DOMContentLoaded', () => {
    loadExam();

    // Slider sync
    $('question-slider').addEventListener('input', (e) => {
        $('slider-display').textContent = e.target.value;
    });

    // Start
    $('start-btn').addEventListener('click', startExam);

    // Navigation
    $('prev-btn').addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderQuestion();
        }
    });

    $('next-btn').addEventListener('click', () => {
        if (currentIndex === selectedQuestions.length - 1) {
            finishExam();
        } else {
            currentIndex++;
            renderQuestion();
        }
    });

    // Hint
    $('hint-btn').addEventListener('click', showHint);

    // Results
    $('retry-btn').addEventListener('click', retryExam);
    $('review-btn').addEventListener('click', toggleReview);
});
