// Update chapter progress based on scroll position
function updateChapterProgress() {
    // Get all chapter sections
    const chapters = Array.from(document.querySelectorAll('section[id^="chapter"]'));
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollPosition = window.scrollY;

    // Process each chapter
    chapters.forEach(chapter => {
        const chapterId = chapter.id;
        // Find the nav item for this chapter
        const navItem = document.querySelector(`.nav-chapter[href="#${chapterId}"]`);
        if (!navItem) return;

        const chapterNumber = navItem.querySelector('.chapter-number');
        if (!chapterNumber) return;

        // Calculate chapter boundaries
        const chapterTop = chapter.offsetTop;
        const chapterHeight = chapter.offsetHeight;
        const chapterBottom = chapterTop + chapterHeight;

        // Calculate progress percentage
        let progress = 0;

        // If we're before the chapter, progress is 0
        if (scrollPosition < chapterTop) {
            progress = 0;
        }
        // If we're after the chapter, progress is 100%
        else if (scrollPosition > chapterBottom - viewportHeight) {
            progress = 100;
        }
        // If we're in the chapter, calculate percentage
        else {
            const visiblePortion = scrollPosition + viewportHeight - chapterTop;
            progress = Math.min(100, Math.max(0, (visiblePortion / chapterHeight) * 100));
        }

        // Update the fill height based on progress
        chapterNumber.style.setProperty('--progress-height', `${progress}%`);

        // Add a title attribute for accessibility
        const chapterTitle = chapter.querySelector('h1, h2, h3')?.textContent || chapter.id;
        const progressRounded = Math.round(progress);
        chapterNumber.setAttribute('title', `${chapterTitle}: ${progressRounded}% viewed`);

        // Add a special class if the chapter is complete
        if (progress >= 95) {
            navItem.classList.add('chapter-complete');
        } else {
            navItem.classList.remove('chapter-complete');
        }
    });
}

// Initialize progress tracking
function initChapterProgress() {
    // Start tracking scroll progress
    updateChapterProgress();
    window.addEventListener('scroll', updateChapterProgress);
    window.addEventListener('resize', updateChapterProgress);
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initChapterProgress();

    // Rest of your existing initialization code
});