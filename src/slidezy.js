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
            prevButton: null,
            nextButton: null,
            slideBy: 1, // number || 'page'
            autoplay: false,
            autoplayDelay: 3000,
            autoplayPauseOnHover: true,
        },
        options
    );

    this.slides = Array.from(this.container.children);
    this._slideCount = this.slides.length;
    this.currentIndex = this.opt.loop ? this._getCloneCount() : 0;
    this._maxIndex = this.slides.length - this.opt.items;

    this._init();
    this._updatePosition();
}

Slidezy.prototype._init = function () {
    this.container.classList.add('slidezy-wrapper');

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
        this._maxIndex = this.slides.length - items; // check lại chỗ này
    }

    this.slides.forEach((slide) => {
        slide.classList.add('slidezy-slide');
        slide.style.flexBasis = `calc(100% / ${items})`;
        this.track.appendChild(slide);
    });

    this.content.appendChild(this.track);
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
            let step = i * items - this.currentIndex; // no loop
            if (this.opt.loop) step += this._getCloneCount(); // loop
            this.moveSlide(step);
        });

        this.paginationWrapper.appendChild(paginationBtn);
    }

    this.container.appendChild(this.paginationWrapper);
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
    if (!loop && realIndex === this._maxIndex) {
        const pageCount = Math.ceil(this._slideCount / items);
        pageIndex = pageCount - 1; // Luôn lấy index của trang cuối cùng
    }

    const paginationBtns = Array.from(this.paginationWrapper.children);

    paginationBtns.forEach((btn, index) => {
        btn.classList.toggle('active', pageIndex === index);
    });
};

Slidezy.prototype._createControls = function () {
    const { items, prevButton, nextButton, slideBy } = this.opt;

    this.prevBtn = prevButton
        ? document.querySelector(prevButton)
        : document.createElement('button');
    this.nextBtn = nextButton
        ? document.querySelector(nextButton)
        : document.createElement('button');

    if (!prevButton) {
        this.prevBtn.className = 'slidezy-prev';
        this.prevBtn.textContent = this.opt.controlsText[0];
        this.content.appendChild(this.prevBtn);
    }

    if (!nextButton) {
        this.nextBtn.className = 'slidezy-next';
        this.nextBtn.textContent = this.opt.controlsText[1];
        this.content.appendChild(this.nextBtn);
    }

    const stepBy = this._getSlideBy();

    this.prevBtn.addEventListener('click', () => {
        this.moveSlide(-stepBy);
    });

    this.nextBtn.addEventListener('click', () => {
        this.moveSlide(stepBy);
    });

    this._disableBtn();
};

Slidezy.prototype._getSlideBy = function () {
    return this.opt.slideBy === 'page' ? this.opt.items : this.opt.slideBy;
};

Slidezy.prototype.moveSlide = function (step) {
    if (this._isMoving) return;
    this._isMoving = true;

    this.currentIndex = Math.min(Math.max(this.currentIndex + step, 0), this._maxIndex);
    // Giải thích:
    // Khi click thì sẽ gán lại: currentIndex = currentIndex + step. Tuy nhiên phải giới hạn:
    //  - Math.max(this.currentIndex + step, 0) → lấy số lớn nhất. Nếu index < 0 thì sẽ lấy 0 vì array index không thể là số âm
    //  - Math.min(..., maxIndex) → lấy số nhỏ nhất. Nếu index lớn hơn 'maxIndex' thì sẽ lấy 'maxIndex'
    //      - 'maxIndex' là tổng số slide trừ đi số slide đang hiển thị → để không bị trống slide khi chạy đến cuối cùng
    //        VD: có 9 slide, hiển thị 3 slide thì index lớn nhất của currentIndex là 6 (6, 7, 8)

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
    const cloneCount = this._getCloneCount();

    if (this.currentIndex > this._maxIndex - cloneCount) {
        // check xem có cần sửa điều kiện if ở đây không
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
    this.prevBtn.classList.toggle('disable', this.currentIndex <= 0);
    this.nextBtn.classList.toggle('disable', this.currentIndex >= this._maxIndex);
};
