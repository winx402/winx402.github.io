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