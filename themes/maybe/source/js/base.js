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

$(".post .con img").click(function () {
    var url = $(this).attr("src");
    var img = $(".img-view span img")
    var h = $(window).height()-20;
    var w = $(window).width()-40;
    img.attr("src",url);
    img.css({"max-height": h+"px","min-height":"50%","min-width":""});
    img.css({"max-width":w+"px","min-width":"50%","min-height":""});
    $(".img-view").css("display","table");
});

$(".img-view").click(function () {
    $(".img-view").css("display","none");
});
