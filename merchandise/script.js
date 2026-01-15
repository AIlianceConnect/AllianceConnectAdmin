// Shopping Cart Class
class ShoppingCart {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('cart')) || [];
        this.updateCartIcon();
        this.checkoutModal = null;
        this.cartModal = null;
    }

    addItem(product, quantity = 1) {
        const sizeRadio = document.querySelector(`input[name="size-${product.id}"]:checked`);
        const size = sizeRadio ? sizeRadio.value : 'N/A';
        let adjustedPrice = product.price;
        if (size === '2XL' || size === '3XL') {
            adjustedPrice += 100;
        } else if (size === '4XL' || size === '5XL') {
            adjustedPrice += 150;
        }
        const existingItem = this.items.find(item => item.id === product.id && item.size === size);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({ 
                ...product, 
                price: adjustedPrice, 
                quantity: quantity, 
                size: size,
                image: (product.gallery && product.gallery[1]) ? product.gallery[1] : product.image
            });
        }
        this.saveCart();
        this.updateCartIcon();
        this.showNotification('Item added to cart!');
    }

    removeItem(productId, size) {
        this.items = this.items.filter(item => !(item.id === productId && item.size === size));
        this.saveCart();
        this.updateCartIcon();
        this.showNotification('Item removed from cart!');
        this.renderCart();
    }

    updateQuantity(productId, quantity, size) {
        const item = this.items.find(item => item.id === productId && item.size === size);
        if (item) {
            item.quantity = Math.max(0, quantity);
            if (item.quantity === 0) {
                this.removeItem(productId, size);
            } else {
                this.saveCart();
                this.updateCartIcon();
            }
        }
    }

    getTotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getItemCount() {
        return this.items.reduce((count, item) => count + item.quantity, 0);
    }

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.items));
    }

    updateCartIcon() {
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            cartCount.textContent = this.getItemCount();
            cartCount.style.display = this.getItemCount() > 0 ? 'block' : 'none';
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    renderCart() {
        const cartItems = document.getElementById('cart-items');
        const cartTotal = document.getElementById('cart-total-amount');
        
        if (!cartItems) return;

        cartItems.innerHTML = this.items.map((item, idx) => `
            <div class="cart-item d-flex align-items-center" data-id="${item.id}">
                <div class="cart-item-number" style="min-width: 2em; text-align: right; font-weight: bold; font-size: 1.1em; margin-right: 10px;">${idx + 1}.</div>
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <h6>${item.name}${item.size !== 'N/A' ? ` (${item.size})` : ''}</h6>
                    <p>₱${item.price.toFixed(2)}</p>
                    <div class="cart-item-quantity">
                        <button class="btn btn-sm btn-outline-secondary cart-qty-btn" data-action="decrement" data-id="${item.id}" data-size="${item.size}">-</button>
                        <span>${item.quantity}</span>
                        <button class="btn btn-sm btn-outline-secondary cart-qty-btn" data-action="increment" data-id="${item.id}" data-size="${item.size}">+</button>
                    </div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="cart.removeItem(${item.id}, '${item.size}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        cartTotal.textContent = this.getTotal().toFixed(2);

        // Add event listeners for quantity buttons
        cartItems.querySelectorAll('.cart-qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-id'));
                const size = btn.getAttribute('data-size');
                const action = btn.getAttribute('data-action');
                const item = this.items.find(i => i.id === id && i.size === size);
                if (!item) return;
                if (action === 'increment') {
                    this.updateQuantity(id, item.quantity + 1, size);
                } else if (action === 'decrement') {
                    this.updateQuantity(id, item.quantity - 1, size);
                }
                this.renderCart(); // Re-render to update UI
            });
        });
    }

    checkout() {
        if (this.items.length === 0) {
            this.showNotification('Your cart is empty!');
            return;
        }

        // Close cart modal and show checkout modal
        if (this.cartModal) {
            this.cartModal.hide();
        }
        
        if (!this.checkoutModal) {
            this.checkoutModal = new bootstrap.Modal(document.getElementById('checkoutModal'));
        }
        this.checkoutModal.show();
    }

    async processCheckout() {
        const form = document.getElementById('checkout-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const paymentMode = document.querySelector('input[name="paymentMode"]:checked').value;
        const gcashReference = document.getElementById('gcashReference').value;

        // If GCash is selected, verify the reference number
        if (paymentMode === 'Gcash' && gcashReference) {
            // Show loading state
            const confirmButton = document.getElementById('confirm-checkout');
            const originalText = confirmButton.textContent;
            confirmButton.disabled = true;
            confirmButton.textContent = 'Verifying Payment...';

            try {
                // Here you would typically make an API call to verify the GCash payment
                // For now, we'll simulate a verification delay
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Simulate verification (replace this with actual verification logic)
                const isVerified = true; // This should come from your actual verification system

                if (!isVerified) {
                    throw new Error('Payment verification failed. Please check your reference number and try again.');
                }

                // If verification is successful, proceed with the order
                await this.submitOrder(form);
                
            } catch (error) {
                console.error('Payment verification error:', error);
                this.showNotification(error.message || 'Payment verification failed. Please try again.');
                confirmButton.disabled = false;
                confirmButton.textContent = originalText;
                return;
            }
        } else {
            // For cash payments, proceed directly
            await this.submitOrder(form);
        }
    }

    async submitOrder(form) {
        const formData = {
            studentNumber: document.getElementById('studentNumber').value,
            studentName: document.getElementById('studentName').value,
            section: document.getElementById('section').value,
            email: document.getElementById('email').value,
            paymentMode: document.querySelector('input[name="paymentMode"]:checked').value,
            gcashReference: document.getElementById('gcashReference').value,
            items: this.items.map(item => `${item.name}${item.size !== 'N/A' ? ` (${item.size})` : ''} (${item.quantity}x)`).join(', '),
            total: this.getTotal().toFixed(2)
        };

        try {
            // Replace with your actual Google Form formResponse URL
            const submitUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSe4grnNLFBLZ-1toQsjUpBdMGZCT6iXo25Qr5_NGm6ma174Vw/formResponse';

            // Map your form fields to Google Form entry IDs
            const formFields = {
                'entry.1011423076': formData.studentNumber,   // Student Number
                'entry.84552753': formData.studentName,       // Student Name
                'entry.964847782': formData.section,          // Section
                'entry.135040288': formData.email,            // Email
                'entry.859203702': formData.items,            // Order Items
                'entry.494570708': formData.total,            // Total Amount
                'entry.308295728': formData.paymentMode,      // Payment Mode
                'entry.735505920': formData.gcashReference    // GCash Reference (update this entry ID to match your Google Form)
            };

            // Build form body for x-www-form-urlencoded
            const body = Object.entries(formFields)
                .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
                .join('&');

            // Submit via fetch (AJAX)
            const response = await fetch(submitUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body,
                mode: 'no-cors' // Google Forms does not support CORS, so we use no-cors
            });

            // Show success message
            this.showNotification('Thank you for your purchase! A confirmation email with your receipt will be sent to your email address shortly.');
            
            // Clear cart and close modal
            this.items = [];
            this.saveCart();
            this.updateCartIcon();
            this.renderCart();
            
            if (this.checkoutModal) {
                this.checkoutModal.hide();
            }

            // Reset form
            form.reset();

            // Reset confirm button
            const confirmButton = document.getElementById('confirm-checkout');
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirm Order';

        } catch (error) {
            console.error('Error submitting order:', error);
            this.showNotification('There was an error processing your order. Please try again.');
            
            // Reset confirm button
            const confirmButton = document.getElementById('confirm-checkout');
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirm Order';
        }
    }
}

// Product Data
const products = [
    // PAGLAOM COLLECTION
    {
        id: 1,
        name: 'PAGLAOM V1.1 T-SHIRT',
        price: 400.00,
        image: 'Photos/elite sizechart.jfif',
        gallery: [
            'Photos/bluecorner sizechart.png',  
            'Photos/V2.1.png',
        ],
        description: 'Premium quality t-shirt with our organization\'s V2.1 design.',
        category: 'V2'
    },
    {
        id: 2,
        name: 'PAGLAOM V1.2 T-SHIRT',
        price: 350.00,
        image: 'Photos/elite sizechart.jfif',
        gallery: [
            'Photos/bluecorner sizechart.png',  
            'Photos/V2.2.png',
        ],
        description: 'Premium quality t-shirt with our organization\'s V2.2 design.',
        category: 'V2'
    },
    // Stickers Collection
    {
        id: 3,
        name: 'Hirono Uniform Sticker',
        price: 30.00,
        image: 'Photos/hirono-uniform.jfif',  // Using your existing image
        gallery: [

        ],
        description: 'High-quality vinyl sticker featuring the Hirono Uniform design.',
        category: 'Stickers'
    },
    {
        id: 4,
        name: 'Hirono Airplane Sticker',
        price: 30.00,
        image: 'Photos/hirono-airplane.jfif',
        gallery: [

        ],
        description: 'High-quality vinyl sticker featuring the Hirono Airplane design.',
        category: 'Stickers'
    },
    {
        id: 5,
        name: 'Hirono Computer Enthusiasts Sticker',
        price: 30.00,
        image: 'Photos/computer-enthusiast.jfif',
        gallery: [

        ],
        description: 'High-quality vinyl sticker featuring the Hirono Computer Enthusiasts design.',
        category: 'Stickers'
    },
    {
        id: 6,
        name: 'Sticker Set A',
        price: 80.00,
        image: 'Photos/set-a.png',
        description: 'Collection of our most popular sticker designs in one set.',
        category: 'Stickers'
    },
    {
        id: 7,
        name: 'Sticker Set B',
        price: 100.00,
        image: 'Photos/set-b.jfif',
        description: 'Collection of our exclusive sticker designs in one set.',
        category: 'Stickers'
    },
    // ISKOLEHIYO Collection
    {
        id: 8,
        name: 'ISKOLEHIYO T-SHIRT V1.1',
        price: 350.00,
        image: 'Photos/elite sizechart.jfif',
        gallery: [
            'Photos/bluecorner sizechart.png',  
            'Photos/full1.1.png',
        ],
        description: 'High-quality vinyl sticker featuring the Hirono Uniform design.',
        category: 'ISKOLEHIYO'
    },
    {
        id: 9,
        name: 'ISKOLEHIYO T-SHIRT V1.2',
        price: 350.00,
        image: 'Photos/elite sizechart.jfif',
        gallery: [
            'Photos/bluecorner sizechart.png',  
            'Photos/full1.2.png',
        ],
        description: 'High-quality vinyl sticker featuring the Hirono Airplane design.',
        category: 'ISKOLEHIYO'
    },
    {
        id: 10,
        name: 'ISKOLEHIYO T-SHIRT V1.3',
        price: 350.00,
        image: 'Photos/elite sizechart.jfif',
        gallery: [
            'Photos/bluecorner sizechart.png',  
            'Photos/full1.3.png',
            'Photos/full 1.3.png',
        ],
        description: 'High-quality vinyl sticker featuring the Hirono Computer Enthusiasts design.',
        category: 'ISKOLEHIYO'
    },
    {
        id: 11,
        name: 'ISKOLEHIYO TOTE BAG V1.1',
        price: 250.00,
        image: 'Photos/fulltotebag1.1.png',
        description: 'Collection of our most popular sticker designs in one set.',
        category: 'ISKOLEHIYO'
    },
    {
        id: 12,
        name: 'ISKOLEHIYO TOTE BAG V1.2',
        price: 250.00,
        image: 'Photos/fulltotebag1.2.png',
        description: 'Collection of our exclusive sticker designs in one set.',
        category: 'ISKOLEHIYO'
    },
    {
        id: 13,
        name: 'AIRPLANE PIN',
        price: 45.00,
        image: 'Photos/airplanepin.png',
        description: 'Collection of our most popular sticker designs in one set.',
        category: 'ISKOLEHIYO'
    },
    {
        id: 14,
        name: 'REMOVE BEFORE FLIGHT TAG',
        price: 45.00,
        image: 'Photos/removebeforeflight.png',
        description: 'Collection of our exclusive sticker designs in one set.',
        category: 'ISKOLEHIYO'
    }

];

// Initialize cart
const cart = new ShoppingCart();

// Gallery functionality
class Gallery {
    constructor() {
        this.currentProduct = null;
        this.currentImageIndex = 0;
        this.modal = null;
        this.modalElement = null;
    }

    init() {
        this.modalElement = document.getElementById('imageModal');
        this.modal = new bootstrap.Modal(this.modalElement);
        
        // Add event listener for modal hidden event
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            // Remove any lingering backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            // Remove modal-open class from body
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Previous button
        document.getElementById('prevImage').addEventListener('click', () => this.navigate(-1));
        
        // Next button
        document.getElementById('nextImage').addEventListener('click', () => this.navigate(1));
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.modal._element.classList.contains('show')) return;
            
            if (e.key === 'ArrowLeft') this.navigate(-1);
            if (e.key === 'ArrowRight') this.navigate(1);
            if (e.key === 'Escape') this.modal.hide();
        });
    }

    show(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        this.currentProduct = product;
        this.currentImageIndex = 0;
        this.updateGallery();
        
        // Ensure any existing backdrop is removed before showing
        const existingBackdrop = document.querySelector('.modal-backdrop');
        if (existingBackdrop) {
            existingBackdrop.remove();
        }
        
        this.modal.show();
    }

    navigate(direction) {
        if (!this.currentProduct) return;

        const images = [this.currentProduct.image, ...(this.currentProduct.gallery || [])];
        this.currentImageIndex = (this.currentImageIndex + direction + images.length) % images.length;
        this.updateGallery();
    }

    updateGallery() {
        if (!this.currentProduct) return;

        const images = [this.currentProduct.image, ...(this.currentProduct.gallery || [])];
        const fullSizeImg = document.getElementById('fullSizeImage');
        const title = document.getElementById('galleryTitle');
        const description = document.getElementById('galleryDescription');
        const thumbnails = document.getElementById('galleryThumbnails');

        // Update main image
        fullSizeImg.src = images[this.currentImageIndex];

        // Update title and description
        title.textContent = this.currentProduct.name;
        description.textContent = this.currentProduct.description;

        // Update thumbnails
        thumbnails.innerHTML = images.map((img, index) => `
            <img src="${img}" 
                 alt="Thumbnail ${index + 1}" 
                 class="thumbnail ${index === this.currentImageIndex ? 'active' : ''}"
                 onclick="gallery.showImage(${index})">
        `).join('');

        // Update navigation buttons visibility
        document.getElementById('prevImage').style.display = images.length > 1 ? 'flex' : 'none';
        document.getElementById('nextImage').style.display = images.length > 1 ? 'flex' : 'none';
    }

    showImage(index) {
        if (!this.currentProduct) return;
        this.currentImageIndex = index;
        this.updateGallery();
    }
}

// Initialize gallery
const gallery = new Gallery();

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Ensure cart icon exists in navbar, or add it if missing
    const navbarNav = document.querySelector('#navbarNav .navbar-nav');
    let cartIcon = document.getElementById('cart-icon');
    if (!cartIcon && navbarNav) {
        const cartItem = document.createElement('li');
        cartItem.className = 'nav-item';
        cartItem.innerHTML = `
            <a class="nav-link" href="#" id="cart-icon">
                <i class="fas fa-shopping-cart"></i>
                <span id="cart-count" class="cart-count">0</span>
            </a>
        `;
        navbarNav.appendChild(cartItem);
        cartIcon = document.getElementById('cart-icon');
    }

    // Initialize modals
    cart.cartModal = new bootstrap.Modal(document.getElementById('cartModal'));
    cart.checkoutModal = new bootstrap.Modal(document.getElementById('checkoutModal'));
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));

    // Add image modal functionality
    document.querySelectorAll('.card-img-top').forEach(img => {
        img.addEventListener('click', () => {
            const fullSizeImg = document.getElementById('fullSizeImage');
            fullSizeImg.src = img.src;
            imageModal.show();
        });
    });

    // Close image modal when clicking on the image
    document.getElementById('imageModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-body') || e.target.id === 'fullSizeImage') {
            imageModal.hide();
        }
    });

    // Add cart modal functionality
    if (cartIcon) {
        cartIcon.addEventListener('click', (e) => {
            e.preventDefault();
            cart.renderCart();
            cart.cartModal.show();
        });
    }

    // Add checkout button functionality
    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn?.addEventListener('click', () => {
        cart.checkout();
    });

    // Handle checkout confirmation
    document.getElementById('confirm-checkout')?.addEventListener('click', () => {
        cart.processCheckout();
    });

    // Add event listeners to add to cart buttons
    document.querySelectorAll('.card .btn-primary').forEach((button) => {
        button.addEventListener('click', () => {
            const productId = parseInt(button.getAttribute('data-product-id'));
            const product = products.find(p => p.id === productId);
            let quantity = 1;
            const quantityInput = document.getElementById(`quantity-${productId}`);
            if (quantityInput) {
                quantity = parseInt(quantityInput.value) || 1;
            }
            if (product) {
                cart.addItem(product, quantity);
                cart.renderCart(); // Update cart modal if it's open
            }
        });
    });

    // Initialize cart count
    cart.updateCartIcon();

    // Show/hide cash message based on payment mode
    const cashRadio = document.getElementById('cashPayment');
    const gcashRadio = document.getElementById('gcashPayment');
    const cashMessage = document.getElementById('cashMessage');
    const gcashDetails = document.getElementById('gcashDetails');
    const gcashReference = document.getElementById('gcashReference');

    if (cashRadio && gcashRadio && cashMessage && gcashDetails) {
        function updatePaymentDetails() {
            if (cashRadio.checked) {
                cashMessage.style.display = 'block';
                gcashDetails.style.display = 'none';
                gcashReference.required = false;
            } else {
                cashMessage.style.display = 'none';
                gcashDetails.style.display = 'block';
                gcashReference.required = true;
            }
        }
        cashRadio.addEventListener('change', updatePaymentDetails);
        gcashRadio.addEventListener('change', updatePaymentDetails);
        updatePaymentDetails(); // Set initial state
    }

    // Initialize gallery
    gallery.init();

    // Update image click handlers
    document.querySelectorAll('.card').forEach(card => {
        const img = card.querySelector('.card-img-top');
        const productId = parseInt(card.querySelector('.btn-primary')?.getAttribute('data-product-id'));
        if (img && productId) {
            img.addEventListener('click', () => {
                gallery.show(productId);
            });
        }
    });

    // Add live price update for size selection
    document.querySelectorAll('.card').forEach(card => {
        const priceElem = card.querySelector('.price');
        if (!priceElem) return;
        // Store base price as data attribute if not already set
        if (!priceElem.hasAttribute('data-base-price')) {
            // Extract base price from text (e.g., '₱400.00')
            const priceText = priceElem.textContent.replace(/[^\d.]/g, '');
            priceElem.setAttribute('data-base-price', priceText);
        }
        const basePrice = parseFloat(priceElem.getAttribute('data-base-price'));
        // Find all size radio buttons in this card
        const sizeRadios = card.querySelectorAll('input[type="radio"][name^="size-"]');
        sizeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                let newPrice = basePrice;
                let extra = 0;
                if (radio.value === '2XL' || radio.value === '3XL') {
                    extra = 100;
                } else if (radio.value === '4XL' || radio.value === '5XL') {
                    extra = 150;
                }
                if (extra > 0) {
                    priceElem.textContent = `₱${basePrice}+${extra}`;
                } else {
                    priceElem.textContent = `₱${basePrice}`;
                }
            });
        });
    });

    // Add scroll animations
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.card, .hero-section, section');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1
        });

        elements.forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(50px)';
            element.style.transition = 'all 0.6s ease-out';
            observer.observe(element);
        });
    };

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add navbar scroll effect
    let lastScroll = 0;
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll <= 0) {
                navbar.style.padding = '1rem';
                navbar.style.backgroundColor = 'var(--black)';
            } else {
                navbar.style.padding = '0.5rem';
                navbar.style.backgroundColor = 'rgba(24, 24, 24, 0.95)';
            }

            if (currentScroll > lastScroll && currentScroll > 500) {
                navbar.style.transform = 'translateY(-100%)';
            } else {
                navbar.style.transform = 'translateY(0)';
            }
            
            lastScroll = currentScroll;
        });
    }

    // Navbar scroll behavior
    let lastScrollTop = 0;
    const navbarElement = document.querySelector('.navbar');
    const scrollThreshold = 100;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        
        if (currentScroll > scrollThreshold) {
            if (currentScroll > lastScrollTop) {
                // Scrolling down
                navbarElement.classList.remove('nav-visible');
                navbarElement.classList.add('nav-hidden');
            } else {
                // Scrolling up
                navbarElement.classList.remove('nav-hidden');
                navbarElement.classList.add('nav-visible');
            }
        } else {
            // At the top
            navbarElement.classList.remove('nav-hidden');
            navbarElement.classList.add('nav-visible');
        }
        
        lastScrollTop = currentScroll;
    });

    // Initialize scroll animations
    animateOnScroll();

    // Add hover effect for buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            button.style.setProperty('--x', `${x}px`);
            button.style.setProperty('--y', `${y}px`);
        });
    });

    // Remove problematic image loading animation
    document.querySelectorAll('img').forEach(img => {
        img.style.opacity = '1';
    });
}); 
