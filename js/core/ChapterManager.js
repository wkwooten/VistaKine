export class ChapterManager {
    constructor(listContainerId, contentContainerId) {
        this.listContainer = document.getElementById(listContainerId);
        this.contentContainer = document.getElementById(contentContainerId);

        // Placeholder chapters structure
        this.chapters = [
            {
                title: 'Introduction to Mechanics',
                sections: ['Basic Concepts', 'Units and Measurements']
            },
            {
                title: 'Kinematics',
                sections: ['Motion in One Dimension', 'Vectors and 2D Motion']
            },
            {
                title: 'Forces and Newton\'s Laws',
                sections: ['Forces', 'Newton\'s Laws of Motion']
            }
        ];

        this.initChapterList();
    }

    initChapterList() {
        this.chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.className = 'placeholder';
            li.textContent = chapter.title;
            li.addEventListener('click', () => this.loadChapter(index));
            this.listContainer.appendChild(li);
        });
    }

    loadChapter(index) {
        const chapter = this.chapters[index];

        // Clear current content
        this.contentContainer.innerHTML = '';

        // Add placeholder content
        const title = document.createElement('h2');
        title.className = 'placeholder';
        title.textContent = chapter.title;
        this.contentContainer.appendChild(title);

        chapter.sections.forEach(section => {
            const div = document.createElement('div');
            div.className = 'placeholder';
            div.textContent = section;
            this.contentContainer.appendChild(div);
        });
    }
}