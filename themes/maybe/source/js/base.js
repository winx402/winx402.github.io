var nowPage;

NProgress.configure({ showSpinner: false, minimum: 0.1 });
NProgress.start();
    $(window).load(function() {
    NProgress.done(true);
    $('.fade').removeClass('out');
    nowPage = location.pathname
});

$(".guide-button,.extend").click(function () {
    var page = $(this).attr("_href");
    if (page == nowPage) {
        $("body").animate({scrollTop:"0px"},600);
    }else {
        nowPage = page;
        location.href = $(this).attr("_href");
    }
});

$(".book-post").click(function () {
    location.href = $(this).attr("_href");
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
    img.css({"max-height": h+"px"});
    img.css({"max-width":w+"px"});
    $(".img-view").css("display","table");
});

$(".img-view").click(function () {
    $(".img-view").css("display","none");
});

$(".guide-extend").mouseover(function () {
    $("#tech-extend").css("display", "block")
});

$(".guide-extend").mouseleave(function () {
    $("#tech-extend").css("display", "none")
});

$("#tech-extend").mouseover(function () {
    $("#tech-extend").css("display", "block")
});

$("#tech-extend").mouseleave(function () {
    $("#tech-extend").css("display", "none")
});
