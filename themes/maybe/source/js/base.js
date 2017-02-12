NProgress.configure({ showSpinner: false, minimum: 0.1 });
NProgress.start();
    $(window).load(function() {
    NProgress.done(true);
    $('.fade').removeClass('out');
});

$(".guide-button").click(function () {
    var classes = $(this).attr('class');
    if (classes.indexOf('guide-selected') != -1) {
        return;
    }
    location.href = $(this).attr("_href");
});

$(".book-post").click(function () {
    location.href = $(this).attr("_href");
});

$(".guide-selected").click(function(){
    $("body").animate({scrollTop:"0px"},600);
});

$("#info-github").click(function(){
    window.open($(this).attr("_href"));
});
