jQuery(document).ready(function ($) {
    const ajaxurl   = customAjaxHandler.ajax_url;
    const security  = customAjaxHandler.security;

    $('.abw-accordion-header').on('click',
        function() {
        var $btn = $(this);
        var expanded = $btn.attr('aria-expanded') === 'true';
        var panelId = $btn.attr('aria-controls');
        var $panel = $('#' + panelId);
        if (expanded) {
            $btn.attr('aria-expanded', 'false');
            $panel.removeClass('open').attr('hidden', 'hidden').css('max-height', '');
        } else {
            $btn.closest('.abw-accordion').find('.abw-accordion-header[aria-expanded="true"]').each(function() {
            var $o = $(this);
            $o.attr('aria-expanded', 'false');
            var $p = $('#' + $o.attr('aria-controls'));
            $p.removeClass('open').attr('hidden', 'hidden').css('max-height', '');
            });
            $btn.attr('aria-expanded', 'true');
            $panel.addClass('open').removeAttr('hidden').css('max-height', $panel.prop('scrollHeight') + 'px');
        }
    });


    // Home Page Product Filtering AJAX - Starts
    $('.product-tabs li').click(function(){

        var category = $(this).data('cat');

        $('.product-tabs li').removeClass('active');
        $(this).addClass('active');

        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'filter_products',
                category: category
            },
            beforeSend: function(){
                $('#ajax-products-container').html('Loading...');
            },
            success: function(response){
                $('#ajax-products-container').html(response);
            }
        });

    });

    function loadProducts(category = 'all') {

        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'filter_products',
                category: category
            },
            beforeSend: function () {

                $('#ajax-products-container').html(
                    '<div class="products-loading"><span class="loader"></span></div>'
                );

            },
            success: function (response) {

                $('#ajax-products-container').html(response);

                if (window.elementorFrontend) {
                    elementorFrontend.init();
                }

            }
        });

    }

    // FIRST LOAD
    loadProducts('all');

    // TAB CLICK
    $('.product-tabs li').click(function () {

        var category = $(this).data('cat');

        $('.product-tabs li').removeClass('active');
        $(this).addClass('active');

        loadProducts(category);
    });
    // Home Page Product Filtering AJAX - Ends

    // Custom Search AJAX - Starts
    let searchTimer;

    $('.custom-search-bar input[type="search"]').on('input', function() {

    clearTimeout(searchTimer);

    const input = $(this);

    searchTimer = setTimeout(function(){

        const input_val = input.val();

        $.ajax({
        url: customAjaxHandler.ajax_url,
        type: 'post',
        dataType: 'json',
        data: {
            action: 'cat_search_results_ajax_action',
            input_val: input_val,
        },
        success: function (response) {
            $('.search-results').html(response.html);
        }
        });

    }, 300);

    });
    // Custom Search AJAX - Ends

    // Custom login page scripts - start
    const submitBtn = $('.pepsci-custom-login .elementor-field-type-submit .elementor-button');

    if (submitBtn.length && !$('.pepsci-custom-login .resources-link').length) {
        $('<a>', {
        href: '/', // Change this to your desired URL
        text: 'Register',
        class: 'register-link',
        }).insertAfter(submitBtn);
    }

    $('a.elementor-lost-password').attr('href', '/password-reset/');
    // Custom login page scripts - end 

    $(document).on('click', '.copy-post-link', function(e) {
        e.preventDefault();

        var $btn = $(this);
        var $svg = $btn.find('svg').first();

        if (!$svg.length) return;

        var originalSVG = $svg.prop('outerHTML');

        var checkSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
            <path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/>
        </svg>`;

        navigator.clipboard.writeText(window.location.href).then(function() {

            // Swap to check icon
            $svg.replaceWith(checkSVG);

            // Revert back after 2 seconds
            setTimeout(function() {
                $btn.find('svg').replaceWith(originalSVG);
            }, 2000);

        }).catch(function(err) {
            console.error('Copy failed:', err);
        });

    });

    // size selection
    $('.pepsci-grams').on('click', function(){
        $('.pepsci-grams').removeClass('is-active');
        $(this).addClass('is-active');

        const formTemplate = $('.pepsci-product-form');

        const variation_id = $(this).data('value');

        if(!variation_id){
            return;
        }

        $.ajax({
            url: ajaxurl,
            type: 'post',
            data: {
                action: 'select_variable_ajax',
                security: security,
                variation_id: variation_id,
            },
            beforeSend: function(){
                formTemplate.addClass('loading');
            },
            success: function (response) {
                if(response.success){
                    formTemplate.find('.price-display').html(response.data?.price);
                    formTemplate.find('.buy-two .price-display').html(response.data?.data_discount?.buy_two);
                    formTemplate.find('.buy-three .price-display').html(response.data?.data_discount?.buy_three);

                    formTemplate.find('.buy-two .buy_two_orig_price').html(response.data?.data_discount?.buy_two_orig_price);
                    formTemplate.find('.buy-three .buy_three_orig_price').html(response.data?.data_discount?.buy_three_orig_price);
                    
                    $('.buy-one input').val(response.data?.default_price);
                    $('.buy-two input').val(response.data?.data_discount?.buy_two_no_currency);
                    $('.buy-three input').val(response.data?.data_discount?.buy_three_no_currency);
                }
                formTemplate.removeClass('loading');
            }
        });
    });

    // Add to cart
    $('.pepsci-product-form').on('submit', function(e) {
        e.preventDefault();
        const dosage        = $('button.pepsci-grams.is-active').data('value');
        const addon_price   = $('input[name="addon_product_id"]:checked').data('price');

        const formData = $(this).serialize();

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'add_to_cart_ajax',
                security: security,
                dosage: dosage,
                formData: formData
            },
            beforeSend: function() {
                $('.pepsci-add-to-cart')
                    .prop('disabled', true)
                    .text('Adding...');
            },
//             success: function(response) {
//                 console.log('response', response);
//                 if (response.success) {

//                     // Refresh mini-cart and cart fragments
//                     $(document.body).trigger('wc_fragment_refresh');

//                 } else {
//                     Swal.fire({
//                         title: 'Error',
//                         text: response.data?.message || 'Failed to add product to cart.',
//                         icon: 'error'
//                     });
//                 }
//             },
			success: function(response) {
    console.log('response', response);

    if (response.success) {

        // Open Elementor side cart
//         $(document.body).trigger(
//             'added_to_cart',
//             [response.fragments || {}, response.cart_hash || '', $('.pepsci-add-to-cart')]
//         );
		$(document.body).trigger(
    'added_to_cart',
    [response.fragments || {}, response.cart_hash || '', $(this).find('.pepsci-add-to-cart')]
);

        // Refresh fragments
        $(document.body).trigger('wc_fragment_refresh');
		
		// Remove WooCommerce View Cart link
        $('.added_to_cart.wc-forward').remove();

    } else {

        Swal.fire({
            title: 'Error',
            text: response.data?.message || 'Failed to add product to cart.',
            icon: 'error'
        });

    }
},
            error: function(xhr, status, error) {
                Swal.fire({
                    title: 'Error',
                    text: error || 'Something went wrong.',
                    icon: 'error'
                });
            },
            complete: function() {
                $('.pepsci-add-to-cart')
                    .prop('disabled', false)
                    .text('Added to Basket');

                setTimeout(function () {
                    $('.pepsci-add-to-cart').text('Add to Cart');
                }, 3000);
            }
        });
    });

    // purchase selection
    $('.pepsci-option input').on('change', function(){
    $('.pepsci-option').removeClass('is-selected');
    $(this).closest('.pepsci-option').addClass('is-selected');
    });

    $('.pepsci-grams-options .pepsci-grams').first().trigger('click');


    // read more toggle - start
    $('.pepsci-readmore-wrapper').each(function () {
        var $wrapper = $(this);
        var $btn = $wrapper.find('.pepsci-readmore-btn');
        var $text = $wrapper.find('.pepsci-readmore-text');

        // Hide button if text doesn't overflow
        if ($text[0].scrollHeight <= $text[0].clientHeight) {
        $btn.hide();
        }

        $btn.on('click', function () {
        $wrapper.toggleClass('expanded');

        if ($wrapper.hasClass('expanded')) {
            $btn.text('See less');
        } else {
            $btn.text('Read more');
        }
        });
    });
    // read more toggle - end


    function removeQty() {
        $('#order_review .product-price .quantity').remove();
    }
    $(document).ready(removeQty);
    $(document).on('updated_checkout', removeQty);


    // Archive add to cart
    $(document).on('click', '.archive-add-to-cart-btn', function(e) {
        e.preventDefault();

        const $btn = $(this);
        const productId = $btn.data('product-id');

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'archive_add_to_cart_ajax',
                product_id: productId
            },
            beforeSend: function() {
                $btn
                    .prop('disabled', true)
                    .text('Adding...');
            },
            success: function(response) {

//                 if (response.success) {

//                     $(document.body).trigger('wc_fragment_refresh');

//                     Swal.fire({
//                         title: 'Success',
//                         text: response.data.message || 'Product added to cart.',
//                         icon: 'success'
//                     });

//                 } 
				if (response.success) {

    // Open Elementor side cart
    $(document.body).trigger(
        'added_to_cart',
        [response.fragments || {}, response.cart_hash || '', $btn]
    );

    // Refresh fragments
    $(document.body).trigger('wc_fragment_refresh');

}
				else {

                    if (response.data.redirect_url) {

                        Swal.fire({
                            title: 'Select Options',
                            text: response.data.message,
                            icon: 'info',
                            confirmButtonText: 'View Product'
                        }).then(() => {
                            window.location.href = response.data.redirect_url;
                        });

                    } else {

                        Swal.fire({
                            title: 'Error',
                            text: response.data.message || 'Failed to add product.',
                            icon: 'error'
                        });

                    }

                }

            },
            error: function() {

                Swal.fire({
                    title: 'Error',
                    text: 'Something went wrong.',
                    icon: 'error'
                });

            },
            complete: function() {
                $btn
                    .prop('disabled', false)
                    .text('Add to Cart');
            }
        });
    });

});


jQuery(window).on('load', function () {
    jQuery('.pepsci-search-bar-header input.hfe-search-form__input')
        .attr('placeholder', 'What can we help you find?');
});
	
function showSection(sectionId) {
            // Hide all sections
            const sections = document.querySelectorAll('.section');
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            // Remove active class from all nav items
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.classList.remove('active');
            });
            
            // Show selected section and activate corresponding nav item
            document.getElementById(sectionId).classList.add('active');
            event.target.classList.add('active');
            
            // Smooth scroll to top of content
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Enhanced scroll effects
        document.addEventListener('DOMContentLoaded', function() {
            // Intersection observer for fade-in animations
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };
            
            const observer = new IntersectionObserver(function(entries) {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, observerOptions);
            
            // Observe all cards and application items
            document.querySelectorAll('.peptide-card, .application-card, .protocol-box').forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                observer.observe(el);
            });

            // Add staggered animation delays
            document.querySelectorAll('.peptides-grid .peptide-card').forEach((card, index) => {
                card.style.transitionDelay = `${index * 0.1}s`;
            });

            document.querySelectorAll('.applications-grid .application-card').forEach((card, index) => {
                card.style.transitionDelay = `${index * 0.1}s`;
            });
        });

        // Smooth nav behavior on scroll
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('.sticky-nav');
            if (!nav) { lastScrollY = window.scrollY; return; }
            if (window.scrollY > lastScrollY && window.scrollY > 100) {
                nav.style.transform = 'translateY(-100%)';
            } else {
                nav.style.transform = 'translateY(0)';
            }
            lastScrollY = window.scrollY;
        });

// Peptide Products AJAX Filtering - Starts
jQuery(function($){

    function loadProducts(filter = 'new') {

        let layout = $('.peptide-layout');

        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'peptide_category_archives',
                filter: filter,
                cat_id: layout.data('category')
            },
            success: function(res) {
                $('.peptide-products-grid').html(res);
            }
        });
    }

    // Click filter
    $(document).on('click', '.peptide-filter a', function(e){
        e.preventDefault();

        let filter = $(this).data('filter');

        $('.peptide-filter a').removeClass('active');
        $(this).addClass('active');

        loadProducts(filter);
    });

    // Initial load
    loadProducts('new');

});
// Peptide Products AJAX Filtering - Ends

// Product Product Nav Dropdown Search AJAX - Starts
jQuery(function ($) {

    let typingTimer;
    let delay = 300;

    function loadProducts(keyword = '') {
        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'ajax_product_search',
                keyword: keyword
            },
            success: function (response) {
                $('#product-search-results').html(response);
            }
        });
    }

    loadProducts();

    $('#product-search-input').on('keyup', function () {

        clearTimeout(typingTimer);

        let keyword = $(this).val();

        typingTimer = setTimeout(function () {

            if (keyword.length < 2) {
                loadProducts(); // fallback to default 5
                return;
            }

            loadProducts(keyword);

        }, delay);
    });

    // click redirect
    $(document).on('click', '.search-list li', function () {
        window.location.href = $(this).data('link');
    });

});
// Product Product Nav Dropdown Search AJAX - Ends

// MOBILE Product Product Nav Dropdown Search AJAX - Starts
jQuery(function ($) {

    let typingTimer;
    let delay = 300;

    function loadProducts2(keyword = '') {
        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'ajax_product_search_mobile',
                keyword: keyword
            },
            success: function (response) {
                $('#product-search-results-mobile').html(response);
            }
        });
    }

    loadProducts2();

    $('#product-search-input-mobile').on('keyup', function () {

        clearTimeout(typingTimer);

        let keyword = $(this).val();

        typingTimer = setTimeout(function () {

            if (keyword.length < 2) {
                loadProducts2(); // fallback to default 5
                return;
            }

            loadProducts2(keyword);

        }, delay);
    });

    // click redirect
    $(document).on('click', '.search-list li', function () {
        window.location.href = $(this).data('link');
    });

});
// MOBILE Product Product Nav Dropdown Search AJAX - Ends

// AJAX Signup Form - Starts
jQuery(function($){

    let accountExists = false;

    $('.clpe-checker-form form').on('submit', function(e){

        e.preventDefault();

        let email = $.trim($('input[name="email_checker"]').val());
        let $result = $('.clpe-checker-result');
        let $submit = $(this).find('[type="submit"]');

        $result.html('').removeClass('success not-found');

        var atPos = email.indexOf('@');
        if (atPos < 1 || email.indexOf('.', atPos) < atPos + 2) {
            $result
                .addClass('not-found')
                .text('Please enter a valid email address.');
            return;
        }

        $submit.prop('disabled', true);

        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'clpe_check_email',
                email: email
            },
            success: function(response){
                accountExists = response.exists;

                $result
                    .removeClass('success not-found')
                    .addClass(response.class)
                    .text(response.message);

                $('.clpe-checker-form').attr('hidden', true);

                if (accountExists) {
                    $('.clpe-login-form').removeAttr('hidden');
                    $('.clpe-login-form input[name="login_username"]').val(email);
                } else {
                    $('.clpe-register-form').removeAttr('hidden');
                    $('.clpe-register-form input[name="register_email"]').val(email);
                }
            },
            complete: function(){
                $submit.prop('disabled', false);
            }
        });

    });

    $('.clpe-back-to-checker').on('click', function () {

        // Hide both forms
        $('.clpe-login-form').attr('hidden', true);
        $('.clpe-register-form').attr('hidden', true);

        // Show checker again
        $('.clpe-checker-form').removeAttr('hidden');

        // Reset checker input + result
        accountExists = false;
        $('input[name="email_checker"]').val('');
        $('.clpe-checker-result').html('');

    });

    $(document).on('click', '.password-toggle', function () {

        var $button = $(this);
        var $input = $button.siblings('input');
        var $icon = $button.find('i');

        if ($input.attr('type') === 'password') {
            $input.attr('type', 'text');
            $icon.removeClass('fa-eye').addClass('fa-eye-slash');
            $button.attr('aria-label', 'Hide password');
        } else {
            $input.attr('type', 'password');
            $icon.removeClass('fa-eye-slash').addClass('fa-eye');
            $button.attr('aria-label', 'Show password');
        }

    });

});


// =====================================================================
// Oath-style 3-step checkout controller (Information -> Shipping -> Payment)
//   - Step navigation within form.clpe-checkout
//   - Relocates WooCommerce's shipping methods into the Shipping step
//   - "+ Add" toggles for optional Company / Address line 2 fields
//   - Research-acknowledgement counter + Place Order gating
// Server-side validation in functions.php remains the authoritative check;
// everything here is progressive enhancement.
// =====================================================================
jQuery(function ($) {

    var $form = $('form.clpe-checkout');
    if (!$form.length) {
        return;
    }

    /* ---------- Step navigation (card collapse / expand) ---------- */
    // Steps before the current one collapse to a checkmark card + summary;
    // the current one is active; later ones are hidden until reached.
    function clpeGoToStep(step) {
        step = parseInt(step, 10) || 1;

        $form.find('.clpe-step').each(function () {
            var $s = $(this);
            var n  = parseInt($s.attr('data-step'), 10);
            $s.removeAttr('hidden').removeClass('is-active is-done is-upcoming');

            if (n < step) {
                $s.addClass('is-done');
                clpeBuildSummary($s, n);
            } else if (n === step) {
                $s.addClass('is-active');
            } else {
                $s.addClass('is-upcoming');
            }
        });

        // Highlight the matching breadcrumb item (if the breadcrumb is present).
        $('.clpe-checkout-steps .clpe-step[data-step]').each(function () {
            $(this).toggleClass('is-current', parseInt($(this).attr('data-step'), 10) === step);
        });

        // Scroll the form back into view. Plain two-argument window.scrollTo(x,y)
        // bypasses both the smoothscroll polyfill and jQuery animate.
        try {
            var top = $form.offset().top - 80;
            window.scrollTo(0, top < 0 ? 0 : top);
        } catch (e) {}

        // Entering Shipping or Payment: recalculate so shipping methods are
        // current and iframe gateways mount while visible.
        if (step === 2 || step === 3) {
            $(document.body).trigger('update_checkout');
        }
    }

    // Build the compact summary shown on a completed step.
    function clpeBuildSummary($step, n) {
        var $sum = $step.find('.clpe-step-summary').first();
        if (!$sum.length) { return; }
        $sum.empty();

        function line(text) {
            text = $.trim(text || '');
            if (text) { $sum.append($('<span></span>').text(text)); }
        }

        if (n === 1) {
            var name  = $.trim(($('#billing_first_name').val() || '') + ' ' + ($('#billing_last_name').val() || ''));
            line($('#billing_email').val());
            line(name);
            line($('#billing_phone').val());

            var parts = [];
            var a1 = $('#billing_address_1').val(); if (a1) { parts.push(a1); }
            var a2 = $('#billing_address_2').val(); if (a2) { parts.push(a2); }
            var city = $('#billing_city').val() || '';
            var $st  = $('#billing_state');
            var state = $st.is('select') ? $.trim($st.find('option:selected').text()) : ($st.val() || '');
            if (state === '*') { state = ''; }
            var zip  = $('#billing_postcode').val() || '';
            var cityLine = [city, state, zip].filter(Boolean).join(', ');
            var addr = [parts.join(', '), cityLine].filter(Boolean).join(', ');
            line(addr);
            if (!$sum.children().length) { line('Details saved'); }
        } else if (n === 2) {
            var $checked = $('#clpe-shipping-target input[type="radio"]:checked, #shipping_method input[type="radio"]:checked').first();
            var label = '';
            if ($checked.length) {
                label = $.trim($checked.closest('li').find('label').text().replace(/\s+/g, ' '));
            }
            line(label || 'Shipping method selected');
        }
    }

    // "Continue" — validate the current step's required fields before advancing.
    $form.on('click', '.clpe-next', function () {
        var $step = $(this).closest('.clpe-step');
        var ok = true;
        var $firstInvalid = null;

        $step.find('input[required], select[required], textarea[required]').each(function () {
            var $f = $(this);
            if ($f.is(':visible') && $.trim($f.val() || '') === '') {
                ok = false;
                if (!$firstInvalid) {
                    $firstInvalid = $f;
                }
            }
        });

        if (!ok) {
            $firstInvalid.trigger('focus');
            return;
        }

        clpeGoToStep($(this).attr('data-next') || 2);
    });

    // "Change" link on a completed step → jump back to it.
    $form.on('click', '.clpe-change', function () {
        clpeGoToStep($(this).attr('data-change') || 1);
    });

    // Legacy back button (kept harmless if present).
    $form.on('click', '.clpe-back', function () {
        clpeGoToStep($(this).attr('data-back') || 1);
    });

    // If WooCommerce reports a checkout error (e.g. invalid billing field),
    // jump back to the Information step so the error notice is visible.
    $(document.body).on('checkout_error', function () {
        clpeGoToStep(1);
    });

    /* ---------- Relocate shipping methods into the Shipping step ---------- */
    // WooCommerce renders the shipping selector inside the summary table and
    // re-renders it on every AJAX refresh. We move the native <ul#shipping_method>
    // (radios keep their names + delegated change handler) into our step, and
    // re-do it after each refresh. The empty summary row is hidden via CSS.
    function clpeMoveShipping() {
        var $target = $('#clpe-shipping-target');
        if (!$target.length) {
            return;
        }

        var $cell = $('#order_review .woocommerce-shipping-totals td').first();

        if ($cell.length && $cell.children().length) {
            // Move the native method list / radios (keeps names + bindings).
            $target.empty().append($cell.children());
        } else if ($cell.length && $.trim($cell.text()) !== '') {
            // Single shipping rate rendered as plain text.
            $target.html('<div class="clpe-shipping-single">' + $.trim($cell.html()) + '</div>');
        }
        // If nothing is available yet, leave whatever is already there
        // (the loading note, or previously moved methods).
    }

    /* ---------- "+ Add" toggles for optional fields ---------- */
    function clpeInitOptionalFields() {
        $('.clpe-optional-field').each(function () {
            var $field = $(this);
            if ($field.data('clpeOptionalReady')) {
                return;
            }
            $field.data('clpeOptionalReady', true);

            var isCompany = $field.hasClass('clpe-optional-company');
            var label = isCompany
                ? '+ Add Company (optional)'
                : ($field.hasClass('clpe-optional-address2')
                    ? '+ Add Address Line 2 (optional)'
                    : '+ Add (optional)');

            var $btn = $('<button type="button" class="clpe-add-optional"></button>')
                .addClass(isCompany ? 'clpe-add-company' : 'clpe-add-address2')
                .text(label);
            $field.before($btn);

            $btn.on('click', function () {
                $field.addClass('is-open');
                $btn.addClass('is-hidden');
                $field.find('input, select, textarea').first().trigger('focus');
            });
        });
    }

    /* ---------- Acknowledgement counter + Place Order gating ---------- */
    function clpeUpdatePlaceOrder() {
        var $btn = $('#place_order');
        var $required = $('.clpe-ack-input');
        var $field = $('#clpe_research_field');

        // Update the "X/Y" counter chip on the accordion button.
        var checked = $required.filter(':checked').length;
        var total = $required.length;
        $('.clpe-ack-count').text(checked);
        $('.clpe-ack-counter').toggleClass('is-complete', total > 0 && checked === total);

        if (!$btn.length) {
            return;
        }

        // No acknowledgement block -> don't interfere with the button.
        if (!$required.length && !$field.length) {
            $btn.prop('disabled', false).removeClass('clpe-disabled');
            return;
        }

        var fieldOk = !$field.length || $.trim($field.val() || '') !== '';

        if (checked === total && fieldOk) {
            $btn.prop('disabled', false).removeClass('clpe-disabled');
        } else {
            $btn.prop('disabled', true).addClass('clpe-disabled');
        }
    }

    $(document).on('change input', '.clpe-ack-input, #clpe_research_field', clpeUpdatePlaceOrder);

    /* ---------- "Select all" master checkbox for acknowledgements ---------- */
    function clpeAckScope($el) {
        var $s = $el.closest('.clpe-acknowledgements');
        return $s.length ? $s : $el.closest('form');
    }

    // Master toggle -> tick/untick every required acknowledgement in scope.
    $(document).on('change', '.clpe-select-all', function () {
        var $scope = clpeAckScope($(this));
        $scope.find('input[type="checkbox"][required]')
              .prop('checked', this.checked)
              .trigger('change');
    });

    // Keep the master box in sync (checked / indeterminate) as boxes change.
    $(document).on('change', '.clpe-acknowledgements input[type="checkbox"], .clpe-register-form input[type="checkbox"]', function () {
        if ($(this).hasClass('clpe-select-all')) { return; }
        var $scope = clpeAckScope($(this));
        if (!$scope.length) { return; }
        var $req = $scope.find('input[type="checkbox"][required]');
        var total = $req.length;
        var checked = $req.filter(':checked').length;
        var $all = $scope.find('.clpe-select-all');
        $all.prop('checked', total > 0 && checked === total);
        $all.prop('indeterminate', checked > 0 && checked < total);
    });

    /* ---------- Inline coupon inside the Order Summary card ---------- */
    // Clone the template coupon form into the summary table, after the line
    // items, on load and after every fragment refresh (the table is replaced).
    function clpeInjectCheckoutCoupon() {
        var $table = $('.woocommerce-checkout-review-order-table');
        if (!$table.length || $table.find('.clpe-coupon-tr').length) { return; }

        var $src = $('.clpe-coupon-source .clpe-summary-coupon').first();
        if (!$src.length) { return; }

        var $tr = $('<tr class="clpe-coupon-tr"><td colspan="2"></td></tr>');
        $tr.find('td').append($src.clone());

        var $tbody = $table.find('tbody').first();
        if ($tbody.length) { $tbody.append($tr); }
        else { $table.find('.cart_item').last().after($tr); }
    }

    /* ---------- Mirror the chosen shipping cost into the summary ---------- */
    // The shipping radios live in step 2; the summary's shipping cell is left
    // empty after the move, so show the selected rate's amount (or a hint).
    function clpeSyncShippingSummary() {
        var $cell = $('#order_review .woocommerce-shipping-totals td').first();
        if (!$cell.length) { return; }

        var $checked = $('#clpe-shipping-target input[type="radio"]:checked').first();
        if ($checked.length) {
            var $amt = $checked.closest('li').find('.amount').first();
            if ($amt.length) {
                $cell.html($amt.clone());
                return;
            }
            var txt = $.trim($checked.closest('li').find('label').text());
            if (txt) { $cell.text(txt); return; }
        }
        // Nothing selected yet (e.g. address not entered).
        if ($.trim($cell.text()) === '') {
            $cell.text('Enter address');
        }
    }

    // Re-mirror when the customer picks a shipping rate in step 2.
    $(document).on('change', '#clpe-shipping-target input[type="radio"]', clpeSyncShippingSummary);

    // The summary table + #payment are re-rendered on every AJAX refresh, so
    // re-run the relocation, coupon, shipping mirror and gating each time.
    $(document.body).on('updated_checkout', function () {
        clpeMoveShipping();
        clpeInjectCheckoutCoupon();
        clpeSyncShippingSummary();
        clpeUpdatePlaceOrder();
    });

    // Initial state.
    clpeInitOptionalFields();
    clpeMoveShipping();
    clpeInjectCheckoutCoupon();
    clpeSyncShippingSummary();
    clpeGoToStep(1);
    clpeUpdatePlaceOrder();

});


// Cart drawer: inject +/- quantity controls into each line item.
// Bundle items (custom_price = total bundle price at qty=1) are flagged server-side
// and will show an alert if the user tries to change them.
jQuery(function ($) {

    // --- helpers ---
    function clpeExtractKey($el) {
        return $el.data('cart_item_key')
            || $el.attr('data-cart_item_key')
            || $el.data('cartItemKey')
            || $el.attr('data-cart-item-key')
            || (function () {
                var m = ($el.attr('href') || '').match(/remove_item=([^&]+)/);
                return m ? decodeURIComponent(m[1]) : null;
            }())
            || null;
    }
    function clpeBuildQtyCtrl(key, qty) {
        return $(
            '<div class="clpe-qty-ctrl">' +
            '<button type="button" class="clpe-qty-btn clpe-qty-minus" data-key="' + key + '" data-delta="-1">−</button>' +
            '<span class="clpe-qty-val">' + qty + '</span>' +
            '<button type="button" class="clpe-qty-btn clpe-qty-plus" data-key="' + key + '" data-delta="1">+</button>' +
            '</div>'
        );
    }

    function clpeInjectQtyControls() {

        // ---- Standard WooCommerce mini-cart items ----
        $('li.mini_cart_item:not(.clpe-qty-init)').each(function () {
            var $item = $(this);
            $item.addClass('clpe-qty-init');

            var $removeBtn = $item.find('a.remove_from_cart_button, a.remove').first();
            var key = clpeExtractKey($removeBtn);
            if (!key) return;

            // ".quantity" text is "N × $price" — extract both
            var $qtySpan  = $item.find('.quantity').first();
            var qty       = 1;
            var priceHtml = '';
            if ($qtySpan.length) {
                var $amt = $qtySpan.find('.amount').first();
                if ($amt.length) { priceHtml = $amt.prop('outerHTML'); }
                var mq = ($qtySpan.text() || '').match(/^\s*(\d+)\s*[×x]/);
                if (mq) { qty = parseInt(mq[1], 10) || 1; }
            }

            var $row = $('<div class="clpe-price-qty"></div>');
            if (priceHtml) { $row.append('<span class="clpe-item-price">' + priceHtml + '</span>'); }
            $row.append(clpeBuildQtyCtrl(key, qty));

            if ($qtySpan.length) { $qtySpan.replaceWith($row); }
            else { $item.find('> a:not(.remove)').after($row); }
        });

        // ---- Elementor Menu Cart items ----
        // Elementor versions differ: v3+ wraps name+price in .product-details;
        // v2 leaves them as flat flex siblings of the image.
        // Either way we guarantee a .clpe-product-info column wrapper so the
        // layout is always: [image] | [name / price+qty stacked vertically].
        $('.elementor-menu-cart__product:not(.clpe-qty-init)').each(function () {
            var $item = $(this);
            $item.addClass('clpe-qty-init');

            var $removeWrap = $item.find('.elementor-menu-cart__product-remove').first();
            var $removeLink = $removeWrap.find('a, button').first();
            var key = clpeExtractKey($removeWrap) || clpeExtractKey($removeLink);
            if (!key) {
                key = clpeExtractKey($item.find('a.remove_from_cart_button, a.remove').first());
            }
            if (!key) return;

            // Parse price + qty from Elementor's price element
            var $priceEl  = $item.find('.elementor-menu-cart__product-price').first();
            var $qtyEl    = $item.find('.elementor-menu-cart__product-quantity').first();
            var qty       = 1;
            var priceHtml = '';

            if ($priceEl.length) {
                var $amt2 = $priceEl.find('.amount').first();
                if ($amt2.length) {
                    priceHtml = $amt2.prop('outerHTML');
                } else {
                    var raw = $.trim($priceEl.text());
                    var mp  = raw.match(/^\s*\d+\s*[×x\xd7]\s*(.*)/);
                    priceHtml = '<span>' + (mp ? $.trim(mp[1]) : raw) + '</span>';
                }
                var mq2 = ($priceEl.text() || '').match(/^\s*(\d+)\s*[×x\xd7]/);
                if (mq2) { qty = parseInt(mq2[1], 10) || 1; }
            } else if ($qtyEl.length) {
                qty = parseInt(($qtyEl.text() || '1').replace(/\D/g, '')) || 1;
            }

            var $row = $('<div class="clpe-price-qty"></div>');
            if (priceHtml) { $row.append('<span class="clpe-item-price">' + priceHtml + '</span>'); }
            $row.append(clpeBuildQtyCtrl(key, qty));

            // If Elementor already provides a details container, mark + use it.
            var $details = $item.find('.elementor-menu-cart__product-details').first();
            if ($details.length) {
                $details.addClass('clpe-product-info');
                if ($priceEl.length)     { $priceEl.replaceWith($row); }
                else if ($qtyEl.length)  { $qtyEl.replaceWith($row); }
                else                     { $details.append($row); }
            } else {
                // Flat structure: create our own column wrapper around name + price+qty.
                var $nameEl = $item.find('.elementor-menu-cart__product-name').first();
                var $imgEl  = $item.find('.elementor-menu-cart__product-image').first();
                var $info   = $('<div class="clpe-product-info"></div>');

                if ($imgEl.length) { $imgEl.after($info); }
                else               { $item.append($info); }

                if ($nameEl.length) { $info.append($nameEl); }   // move name inside
                if ($priceEl.length) { $priceEl.remove(); }      // discard old price el
                if ($qtyEl.length)   { $qtyEl.remove(); }
                $info.append($row);
            }
        });
    }

    // +/- button click — AJAX update, then refresh fragments.
    // Guard against double-fires while a request is in flight (this was the
    // real reason "+" felt broken: a queued click reset the value mid-refresh).
    $(document).on('click', '.clpe-qty-btn', function (e) {
        e.preventDefault();
        var $btn    = $(this);
        var $ctrl   = $btn.closest('.clpe-qty-ctrl');

        if ($ctrl.hasClass('clpe-qty-loading')) {
            return; // ignore rapid repeat clicks until the refresh lands
        }

        var key     = $btn.data('key');
        var delta   = parseInt($btn.data('delta'), 10) || 0;
        var $val    = $ctrl.find('.clpe-qty-val');
        var current = parseInt($val.text(), 10) || 1;
        var newQty  = Math.max(1, current + delta); // 1 minimum — use × to remove

        if (newQty === current) {
            return; // already at the minimum on a "−"
        }

        // Optimistic UI: show the new number immediately so the control feels
        // responsive even when the Elementor widget refreshes on its own clock.
        $val.text(newQty);
        $ctrl.addClass('clpe-qty-loading');

        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: {
                action: 'clpe_update_cart_qty',
                nonce: customAjaxHandler.security,
                cart_item_key: key,
                qty: newQty
            },
            success: function (response) {
                if (response && response.success) {
                    // Refresh both the WooCommerce mini-cart and the Elementor
                    // Menu Cart widget (they listen to different events).
                    $(document.body).trigger('wc_fragment_refresh');
                    $(document.body).trigger('added_to_cart');
                } else {
                    $val.text(current); // roll back the optimistic change
                    $ctrl.removeClass('clpe-qty-loading');
                    alert(response && response.data && response.data.message
                        ? response.data.message
                        : 'Could not update quantity.');
                }
            },
            error: function () {
                $val.text(current);
                $ctrl.removeClass('clpe-qty-loading');
            }
        });
    });

    // ---------- Free-shipping progress bar ----------
    function clpeUpdateFreeShipping() {
        var threshold = parseFloat(customAjaxHandler.free_shipping_min || 0);
        if (!threshold) return;

        var sym = customAjaxHandler.currency_symbol || '$';

        // Parse subtotal from the already-refreshed DOM.
        var $amtEl = $(
            '.woocommerce-mini-cart__total .amount,' +
            '.elementor-menu-cart__subtotal .amount'
        ).first();
        if (!$amtEl.length) return;

        var subtotal = parseFloat($amtEl.text().replace(/[^0-9.]/g, '')) || 0;
        var pct      = Math.min(100, (subtotal / threshold) * 100);
        var left     = Math.max(0, threshold - subtotal).toFixed(2);
        var isFree   = pct >= 100;

        var msg = isFree
            ? 'This order gets <strong>FREE SHIPPING!</strong> <span class="clpe-fs-check">&#10003;</span>'
            : 'Add <strong>' + sym + left + '</strong> more for FREE SHIPPING';

        // Always rebuild so position stays correct after fragment refresh.
        $('.clpe-fs-bar').remove();
        var $anchor = $(
            '.elementor-menu-cart__footer-buttons,' +
            '.woocommerce-mini-cart__buttons.buttons,' +
            'p.woocommerce-mini-cart__buttons'
        ).first();
        if (!$anchor.length) return;

        $anchor.before(
            '<div class="clpe-fs-bar' + (isFree ? ' is-free' : '') + '">' +
            '<p class="clpe-fs-msg">' + msg + '</p>' +
            '<div class="clpe-fs-track"><div class="clpe-fs-fill" style="width:' + pct + '%"></div></div>' +
            '</div>'
        );
    }

    // ---------- Cart drawer extras (House-of-Aminos style) ----------
    // Works for both Elementor Menu Cart structures:
    //   v3 desktop: .elementor-menu-cart__footer-state > .elementor-menu-cart__subtotal
    //                                                   > .elementor-menu-cart__footer-buttons
    //   v2 mobile:  .elementor-menu-cart__subtotal + .elementor-menu-cart__footer-buttons (flat)
    //   WC native:  p.woocommerce-mini-cart__buttons
    function clpeEnhanceCartDrawer() {

        // Subtotal amount — catches all Elementor + WC variants
        var $amtEl = $(
            '.woocommerce-mini-cart__total .amount,' +
            '.elementor-menu-cart__subtotal .amount,' +
            '.elementor-menu-cart__subtotal .woocommerce-Price-amount,' +
            '.elementor-menu-cart__footer-state .woocommerce-Price-amount'
        ).first();
        var subtotalText = $amtEl.length ? $.trim($amtEl.text()) : '';

        // Checkout button — catches desktop footer-state and mobile footer-buttons
        var $checkoutBtn = $(
            '.elementor-menu-cart__footer-buttons a.elementor-button[href*="checkout"],' +
            '.elementor-menu-cart__footer-buttons .elementor-button--checkout,' +
            '.elementor-menu-cart__footer-state a.elementor-button[href*="checkout"],' +
            '.elementor-menu-cart__footer-state .elementor-button--checkout,' +
            '.elementor-menu-cart__main a.elementor-button[href*="checkout"],' +
            '.woocommerce-mini-cart__buttons .button.checkout'
        ).first();

        // 1) Price on the Checkout button
        if ($checkoutBtn.length && subtotalText) {
            var $label = $checkoutBtn.find('.elementor-button-text');
            if (!$label.length) { $label = $checkoutBtn; }
            var base = $label.attr('data-clpe-base');
            if (!base) {
                base = $.trim($label.text()).replace(/\s*[$£€\d][\d.,]*$/, '').trim() || 'Checkout';
                $label.attr('data-clpe-base', base);
            }
            $label.text(base + ' ' + subtotalText);
        }

        // Footer container — catches all variants; fallback = checkout button's parent
        var $footer = $(
            '.elementor-menu-cart__footer-buttons,' +
            '.elementor-menu-cart__footer-state,' +
            '.woocommerce-mini-cart__buttons.buttons,' +
            'p.woocommerce-mini-cart__buttons'
        ).first();
        if (!$footer.length && $checkoutBtn.length) {
            $footer = $checkoutBtn.closest('.elementor-menu-cart__main') || $checkoutBtn.parent();
        }

        // 2) "Continue Shopping" link below the footer
        if ($footer.length && !$(document.body).find('.clpe-continue-shopping').length) {
            $footer.after('<a href="#" class="clpe-continue-shopping">Continue Shopping</a>');
        }

        // 3) "Got a discount code?" collapsible — insert just above the subtotal row
        if ($footer.length && !$(document.body).find('.clpe-cart-discount').length) {
            var $disc = $(
                '<div class="clpe-cart-discount">' +
                  '<button type="button" class="clpe-cart-discount-toggle">' +
                    '<span>Got a discount code?</span>' +
                    '<svg class="clpe-disc-chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">' +
                      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>' +
                    '</svg>' +
                  '</button>' +
                  '<div class="clpe-cart-discount-panel" hidden>' +
                    '<input type="text" class="clpe-coupon-input" placeholder="Discount code" autocomplete="off">' +
                    '<button type="button" class="clpe-coupon-apply">Apply</button>' +
                  '</div>' +
                '</div>'
            );
            var $sub = $(
                '.elementor-menu-cart__subtotal,' +
                '.woocommerce-mini-cart__total,' +
                'p.woocommerce-mini-cart__total,' +
                '.elementor-menu-cart__footer-state'
            ).first();
            if ($sub.length) { $sub.before($disc); }
            else             { $footer.before($disc); }
        }
    }

    // Discount toggle.
    $(document).on('click', '.clpe-cart-discount-toggle', function () {
        var $panel = $(this).siblings('.clpe-cart-discount-panel');
        var willOpen = $panel.prop('hidden');
        $panel.prop('hidden', !willOpen);
        $(this).toggleClass('is-open', willOpen);
        if (willOpen) { $panel.find('.clpe-coupon-input').trigger('focus'); }
    });

    // Apply coupon from the drawer.
    function clpeApplyCoupon($btn) {
        var $input = $btn.siblings('.clpe-coupon-input');
        var code = $.trim($input.val() || '');
        if (!code) { $input.trigger('focus'); return; }
        $btn.prop('disabled', true).text('Applying…');
        $.ajax({
            url: customAjaxHandler.ajax_url,
            type: 'POST',
            data: { action: 'clpe_apply_coupon', nonce: customAjaxHandler.security, code: code },
            success: function (r) {
                if (r && r.success) {
                    $(document.body).trigger('wc_fragment_refresh').trigger('added_to_cart').trigger('update_checkout');
                } else {
                    alert(r && r.data && r.data.message ? r.data.message : 'Coupon could not be applied.');
                    $btn.prop('disabled', false).text('Apply');
                }
            },
            error: function () { $btn.prop('disabled', false).text('Apply'); }
        });
    }
    $(document).on('click', '.clpe-coupon-apply', function () { clpeApplyCoupon($(this)); });
    $(document).on('keydown', '.clpe-coupon-input', function (e) {
        if (e.which === 13) { e.preventDefault(); clpeApplyCoupon($(this).siblings('.clpe-coupon-apply')); }
    });

    // "Continue Shopping" — close whichever drawer is open.
    $(document).on('click', '.clpe-continue-shopping', function (e) {
        e.preventDefault();
        var $close = $('.elementor-menu-cart__close:visible').first();
        if ($close.length) { $close.trigger('click'); return; }
        $('.elementor-menu-cart__toggle.elementor-active').trigger('click');
        $('.side-cart-overlay, .cart-overlay, .mini-cart-overlay, .elementor-menu-cart__container').trigger('click');
    });

    // Re-inject after every WooCommerce fragment refresh.
    clpeInjectQtyControls();
    clpeUpdateFreeShipping();
    clpeEnhanceCartDrawer();
    $(document.body).on(
        'wc_fragments_loaded wc_fragments_refreshed added_to_cart removed_from_cart',
        function () {
            clpeInjectQtyControls();
            clpeUpdateFreeShipping();
            clpeEnhanceCartDrawer();
        }
    );
});