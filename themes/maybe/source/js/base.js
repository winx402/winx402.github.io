NProgress.configure({ showSpinner: false, minimum: 0.1 });
NProgress.start();
    $(window).load(function() {
    NProgress.done(true);
    $('.fade').removeClass('out');
});

$(".guide-button").click(function () {
    location.href = $(this).attr("_href");
});

$(".book-post").click(function () {
    location.href = $(this).attr("_href");
});

$("#gotop").click(function(){
    $("#wrap").animate({scrollTop:"0px"},600);
});

$("#info-github").click(function(){
    window.open($(this).attr("_href"));
});
