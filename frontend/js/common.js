$(document).ready(function () {

    $(".account-name").on("click", function () {
        $(".account-menu").slideToggle("fast");
        $(this).find(".arrow").toggleClass("active");
    });
    $(".lang-current").on("click", function () {
        $(".lang-list").slideToggle("fast");
    });

    $(".choose-currency").on("click", function () {
        $(this).next().slideToggle("fast");
        $(this).find(".arrow").toggleClass("active");
    });
    $(".currency-item").on("click", function () {
        var name = $(this).find("span").text();
        $(this).closest(".choose-block-currency").find(".choose-currency span").text(name);
        $(this).closest(".currency-list").slideToggle("fast");
        $(this).closest(".choose-block-currency").find(".arrow").toggleClass("active");
    });



    $(window).scroll(function () {
        var scrolled = $(this).scrollTop();
        if (scrolled > 67) {
            $('.site-header').addClass("site-header__transform");
        }
        else {
            $('.site-header').removeClass("site-header__transform");
        }
        if (scrolled > 150) {
            $('.site-header').addClass("site-header__fixed");
        }
        else {
            $('.site-header').removeClass("site-header__fixed");
        }
        if (scrolled > 700) {
            $('.bar').addClass("active");
        } else {
            $('.bar').removeClass("active");
        }
    });

    $(".header-btn").on("click", function () {
        $(this).toggleClass("active");
        $(".header-mobile-menu").toggleClass("header-mobile-menu-active");
    });
    $(".mobile-menu-btn").on("click", function () {
        $(this).addClass("active");
        $(".header-btn").toggleClass("active");
        $(".header-mobile-menu").toggleClass("header-mobile-menu-active");
    });

    $('.header-logo a, .header-menu-link, .footer-menu-link').click( function(){
        var tab = $(this).attr('href'); // возьмем содержимое атрибута href, должен быть селектором, т.е. например начинаться с # или .
        if ($(tab).length != 0) { // проверим существование элемента чтобы избежать ошибки
            $('html, body').animate({ scrollTop: $(tab).offset().top }, 500); // анимируем скроолинг к элементу scroll_el
        }
        return false; // выключаем стандартное действие
    });
    $('.mobile-menu-link').click( function(){
        $(".mobile-menu-btn").trigger("click");
    });

    $(".popup-form").magnificPopup({type: 'inline'});
    $(".popup").magnificPopup({type:'inline'});



    $(".ten-text-more").on("click", function () {
        $(this).hide().next().slideDown();
    });
    $(".acord-text:not(:first)").hide();
    $(".acord-title").click(function () {
        $(this).parents(".acord").find(".acord-text").not(this).slideUp().prev().removeClass("active");
        $(this).next().not(":visible").slideDown().prev().addClass("active");
    });



    $(".video-bg").on("click", function () {
        $(this).hide();
        $("#iframe")[0].src += "&autoplay=1";
        ev.preventDefault();
    });





});
