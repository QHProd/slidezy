function Slidezy(selector, options = {}) {
    this.container = document.querySelector(selector);

    if (!this.container) {
        throw new Error(`Slidezy: Container "${selector}" not found!`);
    }

    this.opt = Object.assign(
        {
            items: 1,
            loop: false,
            speed: 300,
            pagination: true,
            controls: true,
            controlsText: ['<', '>'],
            prevButton: null, // selector | element
            nextButton: null, // selector | element
            slideBy: 1, // number | 'page'
            autoplay: false,
            autoplayDelay: 3000,
            autoplayPauseOnHover: true,
        },
        options
    );

    if (!Number.isFinite(this.opt.items) || this.opt.items < 1) {
        console.warn(
            `Slidezy: Invalid "items" value: "${this.opt.items}". ` +
                `Value must be a finite number greater than or equal to 1. ` +
                `Using fallback value of 1.`
        );
        this.opt.items = 1;
    }

    this.slides = Array.from(this.container.children);
    this._slideCount = this.slides.length;
    this.currentIndex = this.opt.loop ? this._getCloneCount() : 0;
    this._maxIndex = this.slides.length - this.opt.items;

    this._init();
    this._updatePosition();
}

Slidezy.prototype._init = function () {
    this.container.classList.add('slidezy-wrapper');

    if (this._slideCount <= this.opt.items) {
        const reason = 'slideCount is less than or equal to items.';

        if (this.opt.loop) {
            this.opt.loop = false;
            console.warn(`Slidezy: "loop" option was disabled because ${reason}`);
        }
        if (this.opt.autoplay) {
            this.opt.autoplay = false;
            console.warn(`Slidezy: "autoplay" option was disabled because ${reason}`);
        }
        if (this.opt.controls) {
            this.opt.controls = false;
            console.warn(`Slidezy: "controls" option was disabled because ${reason}`);
        }
        if (this.opt.pagination) {
            this.opt.pagination = false;
            console.warn(`Slidezy: "pagination" option was disabled because ${reason}`);
        }
    }

    this._createContent();
    this._createTrack();
    this.opt.controls && this._createControls();
    this.opt.pagination && this._createPagination();

    // Xử lý autoplay
    if (this.opt.autoplay) {
        this._startAutoplay();
        this.opt.autoplayPauseOnHover && this._setupAutoplayHover();
    }
};

Slidezy.prototype._startAutoplay = function () {
    if (this.autoplayId) return;

    const slideBy = this._getSlideBy();

    this.autoplayId = setInterval(() => {
        this.moveSlide(slideBy);
    }, this.opt.autoplayDelay);
};

Slidezy.prototype._stopAutoplay = function () {
    if (this.autoplayId) {
        clearInterval(this.autoplayId);
        this.autoplayId = null;
    }
};

Slidezy.prototype._setupAutoplayHover = function () {
    this.content.addEventListener('mouseenter', () => this._stopAutoplay());
    this.content.addEventListener('mouseleave', () => this._startAutoplay());
};

Slidezy.prototype._createContent = function () {
    this.content = document.createElement('div');
    this.content.className = 'slidezy-content';
    this.container.appendChild(this.content);
};

Slidezy.prototype._getCloneCount = function () {
    if (this._slideCount <= this.opt.items) return 0;

    const slideBy = this._getSlideBy();
    const cloneCount = this.opt.items + slideBy;

    // VD: 5 slides, hiển thị 1, slideBy = 2
    // [3 4 5] 1 2 3 4 5 [1 2 3]
    // cloneCount (3) < slideCount (5) → return cloneCount

    // VD: 5 slides, hiển thị 2, slideBy = 4
    // [1 2 3 4 5] 1 2 3 4 5 [1 2 3 4 5]
    // cloneCount (6) > slideCount (5) → return slideCount
    return cloneCount > this._slideCount ? this._slideCount : cloneCount;
};

Slidezy.prototype._createTrack = function () {
    this.track = document.createElement('div');
    this.track.className = 'slidezy-track';

    const { items, loop } = this.opt;
    const cloneCount = this._getCloneCount();

    if (loop && cloneCount > 0) {
        const cloneHead = this.slides.slice(-cloneCount).map((slide) => slide.cloneNode(true));
        const cloneTail = this.slides.slice(0, cloneCount).map((slide) => slide.cloneNode(true));

        this.slides = cloneHead.concat(this.slides).concat(cloneTail);
    }

    const fragment = document.createDocumentFragment();
    this.slides.forEach((slide) => {
        slide.classList.add('slidezy-slide');
        slide.style.flexBasis = `calc(100% / ${items})`;
        fragment.appendChild(slide);
    });
    this.track.appendChild(fragment);
    this.content.appendChild(this.track);

    // Cập nhật lại _maxIndex dựa trên độ dài cuối cùng của mảng this.slides dù có loop hay không
    this._maxIndex = this.slides.length - items;
};

Slidezy.prototype._createPagination = function () {
    const { items, loop } = this.opt;

    this.paginationWrapper = document.createElement('div');
    this.paginationWrapper.classList.add('slidezy-pagination');

    const pageCount = Math.ceil(this._slideCount / items);

    for (let i = 0; i < pageCount; i++) {
        const paginationBtn = document.createElement('button');
        paginationBtn.classList.add('slidezy-pagination-button');

        paginationBtn.addEventListener('click', () => {
            const cloneCount = loop ? this._getCloneCount() : 0;
            const targetIndex = cloneCount + i * items; // absolute index in slides array
            const step = targetIndex - this.currentIndex;
            this.moveSlide(step);
        });

        this.paginationWrapper.appendChild(paginationBtn);
    }

    this.container.appendChild(this.paginationWrapper);
    this.paginationBtns = Array.from(this.paginationWrapper.children);
};

Slidezy.prototype._updatePagination = function () {
    if (!this.paginationWrapper) return;

    const { items, loop } = this.opt;

    let realIndex = this.currentIndex;

    if (loop) {
        // [5 6 7] 1 2 3 4 5 6 7 [1 2 3]             → this.slides
        //  0 1 2  3 4 5 6 7 8 9 10 11 12            → index

        // realIndex = this.currentIndex - cloneCount; // → cloneCount là 3
        // cloneTail → realIndex = 10 - 3 = 7
        // pageIndex = 7 / 3 = 2 (làm tròn dưới)     → index 2 rồi chạy setTimeout về 0

        realIndex =
            (this.currentIndex - this._getCloneCount() + this._slideCount) % this._slideCount;
        // nếu move đến cloneTail → realIndex = (10 - 3 + 7) % 7 = 0
        // pageIndex = 0 / 3 = 0                  → index về thẳng 0
        // không phải cloneTail → realIndex = (5 - 3 + 7) % 7 = 2 → vẫn trả về index thật
    }

    let pageIndex = Math.floor(realIndex / items);

    // nếu loop thì đã xử lý realIndex riêng
    // nếu không loop thì mới có trường hợp realIndex = maxIndex
    // 5 slides, 2 items, 1 slideBy:  [3 4 5] 1 2 3 4 5 [1 2 3]
    //                          index: 0 1 2  3 4 5 6 7  8 9 10
    if (!loop && realIndex === this._maxIndex) {
        const pageCount = Math.ceil(this._slideCount / items);
        pageIndex = pageCount - 1; // Luôn lấy index của trang cuối cùng
    }

    this.paginationBtns.forEach((btn, index) => {
        btn.classList.toggle('active', pageIndex === index);
    });
};

Slidezy.prototype._createControls = function () {
    const { prevButton, nextButton, loop } = this.opt;

    // --- Xử lý Prev Button ---
    // 1. Nếu user cung cấp prevButton
    if (prevButton) {
        if (prevButton.nodeType === Node.ELEMENT_NODE) {
            // 1. Nếu là Element, gán trực tiếp
            this.prevBtn = prevButton;
        } else if (typeof prevButton === 'string') {
            // 2. Nếu là string, query
            this.prevBtn = document.querySelector(prevButton);
            // Ném lỗi nếu tìm không thấy
            if (!this.prevBtn)
                throw new Error(
                    `Slidezy: Custom "prevButton" selector "${prevButton}" did not match any element in the DOM.`
                );
        } else {
            // 3. Nếu là kiểu dữ liệu khác, ném TypeError
            throw new TypeError(
                `Slidezy: Option "prevButton" must be a string (CSS selector) or an Element. Received type: ${typeof prevButton}.`
            );
        }
    } else {
        // 4. Nếu user không cung cấp, tự tạo
        this.prevBtn = document.createElement('button');
        this.prevBtn.type = 'button';
        this.prevBtn.className = 'slidezy-prev';
        this.prevBtn.textContent = this.opt.controlsText[0];
        this.content.appendChild(this.prevBtn);
    }

    // --- Xử lý Next Button ---
    // 1. Nếu user cung cấp nextButton
    if (nextButton) {
        if (nextButton.nodeType === Node.ELEMENT_NODE) {
            this.nextBtn = nextButton;
        } else if (typeof nextButton === 'string') {
            this.nextBtn = document.querySelector(nextButton);
            if (!this.nextBtn)
                throw new Error(
                    `Slidezy: Custom "nextButton" selector "${nextButton}" did not match any element in the DOM.`
                );
        } else {
            throw new TypeError(
                `Slidezy: Option "nextButton" must be a string (CSS selector) or an Element. Received type: ${typeof nextButton}.`
            );
        }
    } else {
        // 2. Nếu user không cung cấp, tự tạo
        this.nextBtn = document.createElement('button');
        this.nextBtn.type = 'button'; // <-- Góp ý
        this.nextBtn.className = 'slidezy-next';
        this.nextBtn.textContent = this.opt.controlsText[1];
        this.content.appendChild(this.nextBtn);
    }

    if (this.prevBtn === this.nextBtn)
        throw new Error('prevButton and nextButton must be different elements');

    // --- Gắn Event Listeners ---
    const stepBy = this._getSlideBy();

    this.prevBtn.addEventListener('click', () => {
        this.moveSlide(-stepBy);
    });

    this.nextBtn.addEventListener('click', () => {
        this.moveSlide(stepBy);
    });

    if (!loop) this._disableBtn();
};

Slidezy.prototype._getSlideBy = function () {
    const num = this.opt.slideBy === 'page' ? this.opt.items : Number(this.opt.slideBy);

    if (!Number.isFinite(num) || num < 1) {
        console.warn(
            `Slidezy: Invalid "slideBy" value: "${this.opt.slideBy}". ` +
                `Value must be 'page' or a finite number greater than or equal to 1. ` +
                `Using fallback value of 1.`
        );
        return 1;
    }

    return num;
};

Slidezy.prototype.moveSlide = function (step) {
    if (this._isMoving) return;
    this._isMoving = true;

    this.currentIndex = Math.min(Math.max(this.currentIndex + step, 0), this._maxIndex);
    // Giải thích:
    // Khi click thì sẽ gán lại: currentIndex = currentIndex + step. Tuy nhiên phải giới hạn:
    //  - Math.max(this.currentIndex + step, 0) → lấy số lớn nhất. Nếu index < 0 thì sẽ lấy 0 vì array index không thể là số âm
    //  - Math.min(..., maxIndex) → lấy số nhỏ nhất. Nếu index lớn hơn 'maxIndex' thì sẽ lấy 'maxIndex'
    //      - 'maxIndex' trong non-loop là slide length trừ đi số slide đang hiển thị → để không bị trống slide khi chạy đến cuối cùng
    //        VD: có 9 slide, hiển thị 3 slide thì index lớn nhất của currentIndex là 6 (6, 7, 8)
    //      - 'maxIndex' trong loop là tổng length (slide + clone) trừ đi số slide đang hiển thị → để không bị trống slide khi chạy đến cuối cùng
    //        VD: có 5 slides, hiển thị 2 slides, 1 slideBy: [3 4 5] 1 2 3 4 5 [1 2 3]
    //                                                index:  0 1 2  3 4 5 6 7  8 9 10
    //                                   → index lớn nhất của currentIndex là 9 (2, 3)

    setTimeout(() => {
        if (this.opt.loop) {
            this._handleLoop();
        }

        this._isMoving = false;
    }, this.opt.speed);

    if (!this.opt.loop) this._disableBtn();
    this._updatePosition();
};

Slidezy.prototype._handleLoop = function () {
    // VD: có 4 slides, hiển thị 1 slides, 2 slideBy: [2 3 4] 1 2 3 4 [1 2 3]
    //                                         index:  0 1 2  3 4 5 6  7 8 9

    // VD: có 5 slides, hiển thị 1 slides, 2 slideBy: [3 4 5] 1 2 3 4 5 [1 2 3]
    //                                         index:  0 1 2  3 4 5 6 7  8 9 10

    // VD: có 5 slides, item 1, slideBy 4:   [1 2 3 4 5] 1 2 3 4 5 [1  2  3  4  5]
    //                                index:  0 1 2 3 4  5 6 7 8 9  10 11 12 13 14
    const cloneCount = this._getCloneCount();
    const tailBoundary = this._maxIndex - cloneCount; // nếu index lớn hơn tailBoundary → ở tail clones
    // nếu index < headBoundary → ở head clones

    if (this.currentIndex > tailBoundary) {
        this.currentIndex -= this._slideCount;
        this._updatePosition(true);
    } else if (this.currentIndex < cloneCount) {
        this.currentIndex += this._slideCount;
        this._updatePosition(true);
    }
};

Slidezy.prototype._updatePosition = function (instant = false) {
    this.track.style.transition = instant ? 'none' : `transform ${this.opt.speed}ms ease`;

    // Di chuyển slide cách 1:
    // this.offset = -this.slides[this.currentIndex].offsetLeft;
    // this.track.style.transform = `translateX(${this.offset}px)`;

    // Di chuyển slide cách 2:
    this.offset = -(this.currentIndex * (100 / this.opt.items));
    this.track.style.transform = `translateX(${this.offset}%)`;

    // Nên dùng cách 1 vì nó linh hoạt hơn, không phụ thuộc vào số slide hiển thị cùng lúc
    // Nên dùng cách 2 vì nó không cần phải tính toán lại vị trí của slide mỗi khi click, chỉ cần biết số slide hiển thị cùng lúc

    // chỉ _updatePagination khi (!instant) để không gọi lần thứ 2 trong moveSlide setTimeout
    if (this.opt.pagination && !instant) this._updatePagination();
};

Slidezy.prototype._disableBtn = function () {
    if (!this.prevBtn || !this.nextBtn) return;
    this.prevBtn.classList.toggle('disable', this.currentIndex <= 0);
    this.nextBtn.classList.toggle('disable', this.currentIndex >= this._maxIndex);
};
