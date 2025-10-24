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
            // Swipe: Gmn & Cld đều có
            swipe: true,
            swipeThreshold: 50, // (đơn vị: pixel) Quãng đường vuốt tối thiểu để kích hoạt
            // Swipe: Cld có mà Gmn không có
            swipeVelocityThreshold: 1.4, // Tốc độ tối thiểu (px/ms) để trigger swipe nhanh
            touchRatio: 1, // Tỷ lệ di chuyển (1 = theo sát ngón tay, 0.5 = chậm hơn)
            resistanceRatio: 0.2, // Tỷ lệ kháng lực ở biên (non-loop mode)
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

    // Xử lý swipe trên mobile:
    // ===== Gmn =====
    // this._isSwiping = false;
    // this._startX = 0;
    // this._startY = 0;
    // this._distX = 0;
    // this._distY = 0;

    // ===== Cld =====
    this._swipeState = {
        isTouching: false, // Đang chạm vào screen
        isDragging: false, // Đang kéo (đã di chuyển đủ xa)
        isVerticalScroll: false, // Đang cuộn dọc chứ không phải swipe slide
        startX: 0, // Vị trí X ban đầu khi chạm
        startY: 0, // Vị trí Y ban đầu khi chạm
        currentX: 0, // Vị trí X hiện tại
        startTime: 0, // Timestamp lúc bắt đầu touch
        currentTranslate: 0, // Giá trị translate hiện tại (%)
        prevTranslate: 0, // Giá trị translate trước đó (để snap back)
        rafId: null,
    };
    this.opt.swipe && this._setupSwipe();
};

/* Handle swipe Gmn: START */
// // Gắn các trình lắng nghe sự kiện touch vào slider
// Slidezy.prototype._setupSwipe = function () {
//     // passive: false là quan trọng để chúng ta có thể gọi e.preventDefault() trong _onTouchMove để chặn cuộn trang theo chiều ngang.
//     this.content.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
//     this.content.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
//     this.content.addEventListener('touchend', (e) => this._onTouchEnd(e));
// };

// // Xử lý khi bắt đầu chạm (touchstart)
// Slidezy.prototype._onTouchStart = function (e) {
//     // Nếu slider đang di chuyển (transition) thì không cho vuốt
//     if (this._isMoving) {
//         return;
//     }

//     // Ghi lại vị trí bắt đầu
//     this._startX = e.touches[0].clientX;
//     this._startY = e.touches[0].clientY;

//     // Reset quãng đường
//     this._distX = 0;
//     this._distY = 0;

//     // Stop autoplay while touching
//     if (this.opt.autoplay) {
//         this._stopAutoplay();
//     }

//     // Đánh dấu là bắt đầu vuốt
//     this._isSwiping = true;
// };

// // Xử lý khi di chuyển ngón tay (touchmove)
// Slidezy.prototype._onTouchMove = function (e) {
//     if (!this._isSwiping) {
//         return;
//     }

//     // Tính toán quãng đường di chuyển
//     this._distX = e.touches[0].clientX - this._startX;
//     this._distY = e.touches[0].clientY - this._startY;

//     // -- PHẦN QUAN TRỌNG NHẤT --
//     // Phân biệt vuốt ngang (swipe) và vuốt dọc (cuộn trang)
//     // Chỉ khi nào vuốt ngang > vuốt dọc, chúng ta mới can thiệp
//     if (Math.abs(this._distX) > Math.abs(this._distY)) {
//         // Nếu là vuốt ngang, chặn hành vi mặc định của trình duyệt
//         // (tránh cuộn trang theo chiều ngang)
//         e.preventDefault();
//     } else {
//         // Nếu là vuốt dọc, đánh dấu là "không vuốt" nữa
//         // để trả lại quyền cuộn trang cho trình duyệt
//         this._isSwiping = false;
//     }
// };

// // Xử lý khi nhấc ngón tay (touchend)
// Slidezy.prototype._onTouchEnd = function (e) {
//     if (!this._isSwiping) {
//         return;
//     }

//     // Reset cờ
//     this._isSwiping = false;

//     // Lấy ngưỡng (threshold) và bước nhảy (step)
//     const threshold = this.opt.swipeThreshold;
//     const step = this._getSlideBy();

//     // Kiểm tra xem quãng đường vuốt (chỉ tính trục X) có đủ lớn không
//     if (Math.abs(this._distX) > threshold) {
//         if (this._distX > 0) {
//             // Vuốt sang phải (clientX tăng) -> Prev slide
//             this.moveSlide(-step);
//         } else {
//             // Vuốt sang trái (clientX giảm) -> Next slide
//             this.moveSlide(step);
//         }
//     }
//     // Nếu không đủ threshold, không làm gì cả (tính là 1 cú "tap")

//     // Resume autoplay
//     if (this.opt.autoplay) {
//         this._startAutoplay();
//     }
// };
/* Handle swipe Gmn: END */

/* Handle swipe Cld: START */
Slidezy.prototype._setupSwipe = function () {
    // Bind các method với this context để có thể remove listeners sau này
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);

    // ===== ĐĂNG KÝ TOUCH EVENTS =====
    // touchstart: Khi bắt đầu chạm vào screen
    // { passive: false } cho phép preventDefault() để ngăn scroll
    this.content.addEventListener('touchstart', this._boundTouchStart, { passive: false });

    // touchmove: Khi di chuyển ngón tay trên screen
    this.content.addEventListener('touchmove', this._boundTouchMove, { passive: false });

    // touchend: Khi nhả ngón tay ra khỏi screen
    this.content.addEventListener('touchend', this._boundTouchEnd);

    // touchcancel: Khi touch bị hủy (vd: phone call, notification)
    this.content.addEventListener('touchcancel', this._boundTouchEnd);

    // ===== NGĂN CONTEXT MENU KHI LONG PRESS =====
    this.content.addEventListener('contextmenu', (e) => {
        if (this._swipeState.isDragging) {
            e.preventDefault();
        }
    });

    // ===== NGĂN DRAG MẶC ĐỊNH CỦA IMAGES =====
    // Tìm tất cả img trong track và disable drag mặc định của browser
    const images = this.track.querySelectorAll('img');
    images.forEach((img) => {
        img.addEventListener('dragstart', (e) => e.preventDefault());
    });

    // ===== THÊM STYLES CHO TRACK =====
    // user-select: none → ngăn select text khi swipe
    this.track.style.userSelect = 'none';
    this.track.style.webkitUserSelect = 'none';
};

/**
 * Handler khi bắt đầu touch
 */
Slidezy.prototype._onTouchStart = function (e) {
    // Nếu đang trong quá trình animation → không xử lý
    if (this._isMoving) return;

    if (e.touches && e.touches.length > 1) return; // ignore multi-touch

    // Lấy thông tin touch đầu tiên (chỉ support single touch)
    const touch = e.touches[0];

    // Xử lý swipe start với tọa độ
    const state = this._swipeState;

    // ===== LƯU TRẠNG THÁI BAN ĐẦU =====
    state.isTouching = true; // Đánh dấu đang touch
    state.isDragging = false; // Chưa drag (chờ vuốt ngang đủ xa)
    state.startX = touch.clientX; // Lưu vị trí X ban đầu
    state.startY = touch.clientY; // Lưu vị trí Y ban đầu
    state.currentX = touch.clientX; // Current X = start X
    state.startTime = Date.now(); // Lưu timestamp để tính velocity sau này
    state.isVerticalScroll = false; // <-- Reset cờ

    // ===== LƯU VỊ TRÍ TRANSLATE HIỆN TẠI =====
    // Tính translate hiện tại dựa trên currentIndex
    // Công thức: -(currentIndex * (100 / items))
    // VD: currentIndex = 2, items = 3 → translate = -66.67%
    state.prevTranslate = -(this.currentIndex * (100 / this.opt.items));
    state.currentTranslate = state.prevTranslate;

    // ===== TẠM DỪNG AUTOPLAY KHI USER ĐANG TOUCH =====
    state.wasAutoplay = !!this.autoplayId;
    if (state.wasAutoplay) this._stopAutoplay();
};

/**
 * Handler khi di chuyển ngón tay trên screen
 */
Slidezy.prototype._onTouchMove = function (e) {
    // Nếu không đang touch → không xử lý
    if (!this._swipeState.isTouching) return;

    // Nếu đã quyết định đây là cuộn dọc, không làm gì nữa
    if (this._swipeState.isVerticalScroll) return;

    // Lấy thông tin touch
    const touch = e.touches[0];

    // Xử lý swipe move
    const state = this._swipeState;

    // Update current position
    state.currentX = touch.clientX;

    // ===== TÍNH KHOẢNG CÁCH DI CHUYỂN =====
    const deltaX = touch.clientX - state.startX; // Khoảng cách ngang (dương = vuốt từ trái sang phải)
    const deltaY = touch.clientY - state.startY; // Khoảng cách dọc (dương = vuốt từ trên xuống dưới)

    // ===== DETECT HƯỚNG SWIPE: NGANG HAY DỌC? =====
    // Chỉ xử lý khi chưa bắt đầu drag
    if (!state.isDragging) {
        // Nếu swipe dọc nhiều hơn ngang → user đang scroll dọc
        // → Không xử lý swipe ngang, để browser handle scroll
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            state.isVerticalScroll = true; // Khóa quyết định

            return; // Exit, không làm gì cả
        }

        // Nếu đi ngang đủ xa (> 5px) → preventDefault để ngăn scroll dọc
        if (Math.abs(deltaX) > 5) {
            e.preventDefault();

            // Đánh dấu đã bắt đầu drag
            state.isDragging = true;

            // ===== TẮT TRANSITION ĐỂ TRACK THEO NGÓN TAY MƯỢT =====
            // Nếu có transition, track sẽ di chuyển từ từ thay vì instant
            this.track.style.transition = 'none';

            // ===== DISABLE POINTER EVENTS TRÊN SLIDES =====
            // Ngăn click/tap vào elements bên trong slides khi đang drag
            this.slides.forEach((slide) => {
                slide.style.pointerEvents = 'none';
            });
        } else {
            // Nếu chưa đủ 5px, không làm gì cả, chờ sự kiện move tiếp theo
            return;
        }
    } else {
        // Đã drag rồi → luôn preventDefault để ngăn scroll
        e.preventDefault();
    }

    // ===== TÍNH TRANSLATE MỚI =====

    // Lấy chiều rộng container
    const containerWidth = this.content.clientWidth;

    // Tính % di chuyển dựa trên deltaX
    // Công thức: (deltaX / containerWidth) * 100
    // VD: deltaX = 100px, width = 1000px → 10%
    // Nhân với touchRatio để điều chỉnh độ nhạy
    const movePercentage = (deltaX / containerWidth) * 100 * this.opt.touchRatio;

    // Translate mới = translate cũ + % di chuyển
    state.currentTranslate = state.prevTranslate + movePercentage;

    // ===== ÁP DỤNG RESISTANCE (KHÁNG LỰC) Ở BIÊN =====
    // Chỉ áp dụng cho non-loop mode
    if (!this.opt.loop) {
        // Tính giới hạn translate
        const minTranslate = -(this._maxIndex * (100 / this.opt.items)); // Biên phải
        const maxTranslate = 0; // Biên trái

        // ===== NẾU VƯỢT QUÁ BIÊN TRÁI (translate > 0) =====
        if (state.currentTranslate > maxTranslate) {
            // Áp dụng resistance: gán lại currentTranslate để chỉ di chuyển 20% khoảng cách vượt
            // Công thức: maxTranslate + (phần vượt * resistanceRatio)
            state.currentTranslate =
                maxTranslate + (state.currentTranslate - maxTranslate) * this.opt.resistanceRatio;
        }
        // ===== NẾU VƯỢT QUÁ BIÊN PHẢI (translate < minTranslate) =====
        else if (state.currentTranslate < minTranslate) {
            // Tương tự, chỉ di chuyển 20%
            state.currentTranslate =
                minTranslate + (state.currentTranslate - minTranslate) * this.opt.resistanceRatio;
        }
    }

    // ===== CẬP NHẬT VỊ TRÍ TRACK =====
    // Apply translate ngay lập tức (theo ngón tay)
    if (this._swipeState.rafId) cancelAnimationFrame(this._swipeState.rafId);

    this._swipeState.rafId = requestAnimationFrame(() => {
        this.track.style.transform = `translateX(${state.currentTranslate}%)`;
    });
};

/**
 * Handler khi kết thúc touch (nhả ngón tay)
 */
Slidezy.prototype._onTouchEnd = function (e) {
    // Nếu không đang touch → không xử lý
    if (!this._swipeState.isTouching) return;

    //  Xử lý kết thúc swipe: Quyết định có slide hay snap back
    const state = this._swipeState;

    // ===== RE-ENABLE POINTER EVENTS =====
    this.slides.forEach((slide) => {
        slide.style.pointerEvents = '';
    });

    // ===== NẾU KHÔNG DRAG (CHỈ TAP) → KHÔNG LÀM GÌ =====
    // (chưa vuốt ngang đủ xa)
    if (!state.isDragging) {
        state.isTouching = false;

        // Restore autoplay nếu user chỉ tap hoặc scroll dọc
        // Cần dùng setTimeout tối thiểu 3ms để tránh lỗi trên chrome:
        //      Lỗi: Nếu user chỉ tap thì autoplay bị dừng và không khôi phục được. Đây là lỗi gì?
        setTimeout(() => {
            if (state.wasAutoplay) this._startAutoplay();
        }, 10);

        return;
    }

    // ===== TÍNH TOÁN KHOẢNG CÁCH VÀ TỐC ĐỘ =====

    // Khoảng cách di chuyển (px)
    const deltaX = state.currentX - state.startX;

    // Thời gian di chuyển (ms)
    const deltaTime = Math.max(1, Date.now() - state.startTime); // Đảm bảo tối thiểu là 1ms, tránh lỗi chia cho 0

    // Tốc độ (px/ms)
    const velocity = Math.abs(deltaX) / deltaTime;

    // ===== QUYẾT ĐỊNH SỐ SLIDE CẦN DI CHUYỂN =====
    let slidesToMove = 0;

    const { swipeThreshold, swipeVelocityThreshold } = this.opt;
    const containerWidth = this.content.clientWidth;

    // ===== CASE 1: SWIPE NHANH (HIGH VELOCITY) VÀ KHOẢNG CÁCH NGẮN =====
    // Nếu swipe nhanh → di chuyển 1 slide dù khoảng cách ngắn
    if (velocity > swipeVelocityThreshold && Math.abs(deltaX) < containerWidth * 0.75) {
        // deltaX > 0: swipe left to right → prev (-1)
        // deltaX < 0: swipe right to left → next (+1)
        slidesToMove = deltaX > 0 ? -1 : 1;
    }
    // ===== CASE 2: SWIPE NHANH VÀ KHOẢNG CÁCH RẤT DÀI (> 3/4 slider container) =====
    // Nếu swipe nhanh và khoảng cách dài hơn 3/4 trang → user muốn di chuyển 1 page
    else if (velocity > swipeVelocityThreshold && Math.abs(deltaX) > containerWidth * 0.75) {
        slidesToMove = deltaX > 0 ? -this.opt.items : this.opt.items;
    }
    // ===== CASE 3: SWIPE CHẬM NHƯNG ĐỦ XA =====
    else if (Math.abs(deltaX) > swipeThreshold) {
        // Tính số slide dựa trên tỷ lệ di chuyển
        const slideWidth = containerWidth / this.opt.items;

        // Làm tròn để lấy số slide nguyên
        // VD: di chuyển 1.7 slide → round = 2 slides
        // Lưu ý: cần đảo dấu vì nếu deltaX > 0 (prev) thì slideToMove phải là số âm
        slidesToMove = -Math.round(deltaX / slideWidth);
    }
    // ===== CASE 4: SWIPE QUÁ NGẮN → SNAP BACK =====
    // slidesToMove = 0 → không di chuyển

    // ===== THỰC HIỆN DI CHUYỂN HOẶC SNAP BACK =====
    if (slidesToMove !== 0) {
        // Có di chuyển → gọi moveSlide()
        // Lưu ý: slidesToMove âm = prev, dương = next
        // Và: moveSlide() nhận: âm = prev, dương = next
        // → Không cần đảo dấu, chỉ cần gọi hàm hàm moveSlide() và truyền slidesToMove vào là được
        this.moveSlide(slidesToMove);
    } else {
        // Không di chuyển → snap back về vị trí cũ
        // Bật lại transition để có animation
        this.track.style.transition = `transform ${this.opt.speed}ms ease`;

        // Update về vị trí currentIndex hiện tại
        this._updatePosition();
    }

    // ===== RESET STATE =====
    state.isTouching = false;
    state.isDragging = false;
    if (this._swipeState.rafId) cancelAnimationFrame(this._swipeState.rafId);

    // ===== RESUME AUTOPLAY SAU KHI END TOUCH =====
    if (state.wasAutoplay) this._startAutoplay();
};
/* Handle swipe Cld: END */

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
