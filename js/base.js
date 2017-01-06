$(document).ready(function ($) {
    $("a#gotop").click(function () {
        $("html,body").animate({scrollTop: "0px"}, 600);
        return false
    });
});
NProgress.configure({showSpinner: false, minimum: 0.1});
NProgress.start();
$(window).load(function () {
    NProgress.done(true);
    $('.fade').removeClass('out');
});

$(".guide-button").click(function () {
    location.href = $(this).attr("_href");
});