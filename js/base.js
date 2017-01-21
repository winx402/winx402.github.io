$(document).ready(function ($) {
    $("a#gotop").click(function () {
        $("html,body").animate({scrollTop: "0px"}, 600);
        return false
    });
});

$(".guide-button").click(function () {
    location.href = $(this).attr("_href");
});