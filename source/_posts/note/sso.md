---
layout: post
title: sso接入流程和遇到的一些问题
date: 2018/03/26
original: true
tags: [tech, index]
tag: [[java, java]]
---

##### 前段时间为新系统接入公司的sso单点登录功能，流程不是很复杂。再加上已经有系统接入成功，依葫芦画瓢起来则更快。但是在这个过程中遇到了一些小问题，所以决定将其记录下来，顺便总结一下sso的实现原理。

<!--more-->

## sso登录流程
![sso](/img/note/sso.png) <div class='img-note'>sso流程图</div>

##### 当然sso的流程不一定非要这样，但是万变不离其宗，我们就以该流程来总结一下sso的原理和实现
1. 用户通过浏览器请求子系统
2. 子系统要查看ticket
3. 如果子系统没有拿到ticket
    1. 携带参数重定向到sso服务器
    2. 服务器进行自己的验证（通常为cookie）
    3. 验证通过：
        1. sso重新生成code，并且携带code请求子系统
        2. 子系统拿到code后再请求sso进行code验证，sso验证code的正确性，
        3. 如果正确则生成ticket并返回，这时候子系统需要保存新的ticket
        4. 如果code验证失败，则需要用户重新登录
    4. 验证失败：
        1. 用户重新登录
4. 用户通过sso公用页面登录的时候，sso生成服务器ticket（也就是记录该用户已经成功登录了sso）并保存在cookie中。
5. 生成code，请求子系统，子系统验证code并拿到客户端ticket。保存后登录成功。

#### 可看到登录的过程主要有两个核心点
1. 子系统保存ticket，并且通过ticket来验证用户是否正常登录（通过实时请求sso）
2. sso系统的登录也有自己的cookie，如果该cookie正常，则用户也是自动登录的。

##### 分析以上的登录流程，子系统主要实现两个接口：
##### **1**. 登录接口，主要是重定向到sso登录页面，当然这部重定向操作也可以通过js完成，但是需要后端确认ticket的合法性再做操作，至于是后端直接重定向还是通过返回参数让前端重定向则不是很重要。所以通常该步操作需要和拦截器一起配合使用。拦截器用于验证ticket。拦截器主要的通过sso提供的接口去验证ticket的合法性。
##### **2**. sso系统回调子系统接口，该接口主要是接受sso系统登录后的code参数，code不是最终的ticket，只是一个中间参数。子系统需要通过code再去请求sso以拿到合法的ticket以及一些登录用户的基础信息。通常这个时候会吧ticket存储在自己的cookie中。

```java
@RequestMapping(value = "/callback", method = RequestMethod.GET)
    public ModelAndView callback(String code, HttpServletRequest request, HttpServletResponse response){

        //1.通过code调用sso/check_code接口获得ticket
        MultiValueMap<String, String> requestBody = new LinkedMultiValueMap<String, String>();
        requestBody.add("code", code);
        requestBody.add("app_id", AuthConstant.APP_ID);
        requestBody.add("app_key", AuthConstant.APP_KEY);

        String result = restTemplate.postForObject(AuthConstant.SSO_URI +"sso/api/check_code",requestBody, String.class);
        logger.info("get result from check_code: result :{}, params:{}", result, requestBody.toString());
        JSONObject resultObj = JSONObject.parseObject(result);
        if(StringUtils.equals(resultObj.getString("errno"),"0")){

            String ticket =  resultObj.getJSONObject("data").getString("ticket");
            String username =  resultObj.getJSONObject("data").getString("username");
            //存储获得的username和ticke,这里把用户名和ticke放到session中
            Cookie usernameCookie = new Cookie("username",username);
            usernameCookie.setPath("/");
            Cookie ticketCookie = new Cookie("ticket",ticket);
            ticketCookie.setPath("/");
            response.addCookie(usernameCookie);
            response.addCookie(ticketCookie);
            return new ModelAndView("redirect:" + localUri);
        }else{
            //打印错误信息,提示等操作
            logger.warn(resultObj.getString("errmsg"));
            return new ModelAndView("redirect:"+ localUri +"auth/login");
        }
    }
```

##### 这里有一个小疑问，为什么不直接通过回调返回ticket呢，而是返回code再去拿ticket。基于这点我问了sso的开发。他们给我的答复是：
1. 兼容以前老的auth的原因
2. ticket不从调转直接返回，防止被窃取，现在是在你们后端调check_code(可以理解为 拿code换ticket)。code换ticket只能调一次，缓存时间是30秒

##### 个人觉得第二点理由有点牵强，可能更多的是考虑到兼容性。

##### 上面说了单个子系统的登录以及验证过程，那么sso是如何实现单点登录的呢。其实很简单，原理就在上面的核心中的第二点。sso也保存了自己的cookie。当用户去到一个新的系统，会发生以下的流程（假设该用户已经在其他系统登录过）：
1. 请求当前新系统的页面
2. 页面拦截器验证ticket。发现没有ticket或者ticket不合法
3. 系统将请求转发到sso登录页面
4. 浏览器转发请求并带上该域名cookie
5. sso通过cookie发现该用户在sso当中已经登录过。则跳过用户登录过程，直接生产code返回给该子系统

## sso登出流程

##### 登出流程基本上和登录流程是相对应的。按照登录的两个核心点，登出的过程也应该是相应的：
1. 清除子系统ticket
2. 清除sso系统cookie

##### 通常清除自己系统的ticket不是必须的，因为就算你不清除，验证sso也不会通过。只是浪费了一次请求操作。
##### 清除sso系统cookie，这步操作则是通过sso给定的登出链接。一般要带上自己系统的app_code。

## 实际操作中遇到的一些问题：
##### 前面已经把sso的登录和登出原理说了个大概。但是在实际操作当中确实遇到了一些问题

### 用户登录后一直请求不到子系统页面，前端一直转菊花
##### 用户在sso登录页面成功了，然后浏览器一直白页面，菊花一直转。查看后端接口日志，发现全是http请求超时，自己查看后发现是ticket验证接口超时。之后再服务器上ping该接口也是超时状态，但是在本地ping则是成功状态。
##### 最后结果很简单，是因为线上服务器没有开通外网权限，而登录页面是重定向到浏览器后浏览器再去请求的，所以之前的流程一直是正常状态。而外网域名在内网服务器上没有办法解析。
##### 解决办法有很多，比如开通外网，或者选用内网router。我们的解决方案就是选用的第二种，其实内网和外网对我们验证ticket没有区别，最终打到他们的服务可能都是相同的。

### 登出问题
##### 这个问题在也是在本地不存在，但是在线上的表现就是登出后浏览器跳转到登录页面，登录页面则直接再跳转回当前系统主页面。
##### 通过问题描述加上前面的分析，你可能会发现问题所在，那就是sso登录页面的cookie没有被清除。至于为什么没有被清除呢，这是上一个问题留下的坑。因为是统一接口，所以登出的流程也是选择使用内网router，但是sso登出接口的重要操作就是清除cookie，cookie一般又是和域名挂钩的。sso登出接口处理cookie后，会直接重定向到登录页面。核心的问题就在于登出接口的域名和登录页面的域名不一致，导致登出过程cookie没有被清除。
##### 解决办法也很简单，登出接口单独维护。之后则一切正常。