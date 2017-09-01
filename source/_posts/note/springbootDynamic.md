---
layout: post
title: spring boot 动态启动与加载
date: 2017/09/01
tags: [tech, note, index, spring]
original: true
---

##### 　　通常情况下，我们通过XML或者Annotation两种方式配置Bean Definition。从Spring 3.0开始，增加了一种新的途径来配置Bean Definition，这就是通过Java Code配置Bean Definition。
<!--more-->

#### Java Code配置与XML和Annotation两种配置方式不同点在于：
##### 　　前两种方式XML和Annotation的配置方式为预定义方式，即开发人员通过XML文件或者Annotation预定义配置Bean的各种属性后，启动Spring容器，Spring容器会首先解析这些配置属性，生成对应的Bean Definition,装入到`DefaultListtableBeanFactory`对象的属性容器中，以此同时，Spring框架也会定义内部使用的Bean定义，如Bean名为：`org.springframework.context.annotation.internalConfigurationAnnotationProcessor`的 `ConfigurationClassPostProcessor` 定义。而后此刻不会做任何Bean Definition的解析动作，Spring框架会根据前两种配置，过滤出`BeanDefinitionRegistryPostProcessor` 类型的Bean定义，并通过Spring框架生成对应的Bean对象（如 `ConfigurationClassPostProcessor` 实例）。结合 Spring 上下文源码可知这个对象是一个 processor 类型工具类，<u>Spring容器会在实例化开发人员所定义的 Bean 前先调用该 processor 的 postProcessBeanDefinitionRegistry(…) 方法。此处实现基于 Java Code 配置Bean Definition的处理</u>。

##### 　　基于 Java Code 的配置方式，其执行原理不同于前两种。它是在 Spring 框架已经解析了基于 XML 和 Annotation 配置后，通过加入 BeanDefinitionRegistryPostProcessor 类型的 processor 来处理配置信息，让开发人员通过 Java 编程方式定义一个 Java 对象。其优点在于可以将配置信息集中在一定数量的 Java 对象中，同时通过 Java 编程方式，比基于 Annotation 方式具有更高的灵活性。并且该配置方式给开发人员提供了一种非常好的范例来增加用户自定义的解析工具类。其主要缺点在于与 Java 代码结合紧密，配置信息的改变需要重新编译 Java 代码，另外这是一种新引入的解析方式，需要一定的学习成本。

<br/>

#### 提及一点的就是，Spring框架有3个主要的Hook类，分别是：
`org.springframework.context.ApplicationContextAware`
##### 它的setApplicationContext 方法将在Spring启动之前第一个被调用。
`org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor`
##### 它的postProcessBeanDefinitionRegistry 和 postProcessBeanFactory 方法是第二和第三被调用，它们在Bean初始化创建之前启动，如果Spring的bean需要的其他第三方中的组件，我们在这里将其注入给Spring。
`org.springframework.context.ApplicationListener`
用于在初始化完成后做一些事情，当Spring所有XML或元注解的Bean都启动被创建成功了，这时会调用它的唯一方法onApplicationEvent。
<br/>
#### 通过 BeanDefinitionRegistryPostProcessor 加载自己的bean的demo：
```java
import org.springframework.beans.BeansException;
import org.springframework.beans.MutablePropertyValues;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.annotation.AnnotatedGenericBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.BeanDefinitionHolder;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionReaderUtils;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;

/**
 * @author winx
 * @create 2017-09-01.
 */
@Configuration
public class MyBeanDefinitionRegistryPostProcessor implements BeanDefinitionRegistryPostProcessor {

    /**
     * 先执行：postProcessBeanDefinitionRegistry()方法
     * 通过Class对象，注册自己的 BeanDefinition
     */
    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {
        try {
            AnnotatedBeanDefinition annotatedBeanDefinition = new AnnotatedGenericBeanDefinition(Class.forName(""));
            BeanDefinitionHolder beanDefinitionHolder = new BeanDefinitionHolder(annotatedBeanDefinition, "beanName");
            BeanDefinitionReaderUtils.registerBeanDefinition(beanDefinitionHolder, registry);
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
    }

    /**
     * 再执行：postProcessBeanFactory()方法。
     * 通过 beanName 拿到注册后的 BeanDefinition
     * 然后加入自定义属性，BeanDefinition 会在初始化bean时，将 Property 键值对插入到之前的Class对象属性中。
     */
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
        BeanDefinition beanDefinition = beanFactory.getBeanDefinition("beanName");
        MutablePropertyValues mutablePropertyValues = beanDefinition.getPropertyValues();
        //加入属性.
        mutablePropertyValues.addPropertyValue("username", "root");
    }
}
```

##### `@Configuration`注解提示spring boot通过该类加载bean
##### `postProcessBeanDefinitionRegistry()` 通过Class对象，注册自己的 BeanDefinition
##### `postProcessBeanFactory()`方法会在`postProcessBeanDefinitionRegistry()`之后执行， 通过beanFactory拿到 BeanDefinition 后加入属性，这一步可以跳过。

### 实际项目需求
##### 　　目前项目分为线上环境和dev环境，项目本身只支持http服务，因为线上环境有nginx做反向代理，所以用http和https均能正常访问线上服务。但是本地环境相对简单，不能支持https服务。先在需要根据环境的不同。动态的扩张spring boot的多连接器设置。当环境为dev时，即加载多连接器，分别用两个端口提供http和https服务。当环境不为dev时，只加载默认http即可。
##### 　　根据这些需求，通过xml或者annotation去定义bean都不太合适。只能是通过java code去判断环境并动态加载。

##### 　　省去spring boot支持https以及多连接器的配置，相关的代码网络上很多。直接说遇到的主要问题吧。上面的demo通过`mutablePropertyValues.addPropertyValue("key", "root");`的方式为目标class定义属性，但是要求属性key必须有相应的set方法。

```java
@Configuration
public class HttpsBeanDefinitionRegistryPostProcessor implements BeanDefinitionRegistryPostProcessor, EnvironmentAware {

    private String profile;

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry beanDefinitionRegistry) throws BeansException {
        if ("dev".equals(profile)){
            AnnotatedBeanDefinition annotatedBeanDefinition = new AnnotatedGenericBeanDefinition(TomcatEmbeddedServletContainerFactory.class);
            BeanDefinitionHolder beanDefinitionHolder = new BeanDefinitionHolder(annotatedBeanDefinition, "tomcatEmbeddedServletContainerFactory");
            BeanDefinitionReaderUtils.registerBeanDefinition(beanDefinitionHolder, beanDefinitionRegistry);
        }
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory configurableListableBeanFactory) throws BeansException {
        MutablePropertyValues tomcatEmbeddedServletContainerFactory = configurableListableBeanFactory.getBeanDefinition("tomcatEmbeddedServletContainerFactory").getPropertyValues();
        tomcatEmbeddedServletContainerFactory.addPropertyValue("additionalTomcatConnectors", getConnector());
    }

    public Connector getConnector(){
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        Http11NioProtocol protocol = (Http11NioProtocol) connector.getProtocolHandler();
        connector.setScheme("https");
        connector.setSecure(true);
        connector.setPort(8443);
        protocol.setSSLEnabled(true);
        protocol.setKeystoreFile("/Users/winx/.keystore");
        protocol.setKeystorePass("123456");
        protocol.setTruststoreFile("/Users/winx/.keystore");
        protocol.setTruststorePass("123456");
        protocol.setKeyAlias("tomcat");
        return connector;
    }

    @Override
    public void setEnvironment(Environment environment) {
        profile = environment.getProperty("profile");
    }
}
```

##### 　　在拿到`MutablePropertyValues`之后，想要给`TomcatEmbeddedServletContainerFactory`对象设置`additionalTomcatConnectors`属性，Connector中包含了https关键信息的设置。之后报错如下：
```
org.springframework.context.ApplicationContextException: Unable to start embedded container; nested exception is org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'tomcatEmbeddedServletContainerFactory': Error setting property values; nested exception is org.springframework.beans.NotWritablePropertyException: Invalid property 'additionalTomcatConnectors' of bean class [org.springframework.boot.context.embedded.tomcat.TomcatEmbeddedServletContainerFactory]: Bean property 'additionalTomcatConnectors' is not writable or has an invalid setter method. Does the parameter type of the setter match the return type of the getter?
	at org.springframework.boot.context.embedded.EmbeddedWebApplicationContext.onRefresh(EmbeddedWebApplicationContext.java:133) ~[spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.context.support.AbstractApplicationContext.refresh(AbstractApplicationContext.java:532) ~[spring-context-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.boot.context.embedded.EmbeddedWebApplicationContext.refresh(EmbeddedWebApplicationContext.java:118) ~[spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.SpringApplication.refresh(SpringApplication.java:760) [spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.SpringApplication.createAndRefreshContext(SpringApplication.java:360) [spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.SpringApplication.run(SpringApplication.java:306) [spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.SpringApplication.run(SpringApplication.java:1185) [spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.SpringApplication.run(SpringApplication.java:1174) [spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at com.winx.es.metis.RunMetis.main(RunMetis.java:47) [classes/:na]
Caused by: org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'tomcatEmbeddedServletContainerFactory': Error setting property values; nested exception is org.springframework.beans.NotWritablePropertyException: Invalid property 'additionalTomcatConnectors' of bean class [org.springframework.boot.context.embedded.tomcat.TomcatEmbeddedServletContainerFactory]: Bean property 'additionalTomcatConnectors' is not writable or has an invalid setter method. Does the parameter type of the setter match the return type of the getter?
	at org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory.applyPropertyValues(AbstractAutowireCapableBeanFactory.java:1518) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory.populateBean(AbstractAutowireCapableBeanFactory.java:1226) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory.doCreateBean(AbstractAutowireCapableBeanFactory.java:543) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory.createBean(AbstractAutowireCapableBeanFactory.java:482) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractBeanFactory$1.getObject(AbstractBeanFactory.java:306) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.DefaultSingletonBeanRegistry.getSingleton(DefaultSingletonBeanRegistry.java:230) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractBeanFactory.doGetBean(AbstractBeanFactory.java:302) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractBeanFactory.getBean(AbstractBeanFactory.java:202) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.boot.context.embedded.EmbeddedWebApplicationContext.getEmbeddedServletContainerFactory(EmbeddedWebApplicationContext.java:195) ~[spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.context.embedded.EmbeddedWebApplicationContext.createEmbeddedServletContainer(EmbeddedWebApplicationContext.java:158) ~[spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	at org.springframework.boot.context.embedded.EmbeddedWebApplicationContext.onRefresh(EmbeddedWebApplicationContext.java:130) ~[spring-boot-1.3.6.RELEASE.jar:1.3.6.RELEASE]
	... 8 common frames omitted
Caused by: org.springframework.beans.NotWritablePropertyException: Invalid property 'additionalTomcatConnectors' of bean class [org.springframework.boot.context.embedded.tomcat.TomcatEmbeddedServletContainerFactory]: Bean property 'additionalTomcatConnectors' is not writable or has an invalid setter method. Does the parameter type of the setter match the return type of the getter?
	at org.springframework.beans.BeanWrapperImpl.createNotWritablePropertyException(BeanWrapperImpl.java:230) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.AbstractNestablePropertyAccessor.setPropertyValue(AbstractNestablePropertyAccessor.java:423) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.AbstractNestablePropertyAccessor.setPropertyValue(AbstractNestablePropertyAccessor.java:280) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.AbstractPropertyAccessor.setPropertyValues(AbstractPropertyAccessor.java:95) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.AbstractPropertyAccessor.setPropertyValues(AbstractPropertyAccessor.java:75) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	at org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory.applyPropertyValues(AbstractAutowireCapableBeanFactory.java:1514) ~[spring-beans-4.2.7.RELEASE.jar:4.2.7.RELEASE]
	... 18 common frames omitted
```

##### 　　**关键错误信息**：`Bean property 'additionalTomcatConnectors' is not writable or has an invalid setter method. Does the parameter type of the setter match the return type of the getter?`，没有权限写入以及没有找到相应的个体方法。

##### 查看`TomcatEmbeddedServletContainerFactory`源码后发现其相应的设置方法如下：
```java
public void addAdditionalTomcatConnectors(Connector... connectors) {
    Assert.notNull(connectors, "Connectors must not be null");
    this.additionalTomcatConnectors.addAll(Arrays.asList(connectors));
}
```

##### 　　顿时觉得坑爹的add啊，之后在Bean Definition的私有属性设置，以及通过方法设置属性值得方向去尝试解决问题，没有任何效果。几乎快要绝望的时候，突然灵机一动，为什么我不能自己定义一个不需要后置设置属性的`TomcatEmbeddedServletContainerFactory`呢，于是有了下面的代码：

```java
@Configuration
public class HttpsBeanDefinitionRegistryPostProcessor implements BeanDefinitionRegistryPostProcessor, EnvironmentAware {

    private String profile;

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry beanDefinitionRegistry) throws BeansException {
        if ("dev".equals(profile)){
            AnnotatedBeanDefinition annotatedBeanDefinition = new AnnotatedGenericBeanDefinition(HttpsTomcatEmbeddedServletContainerFactory.class);
            BeanDefinitionHolder beanDefinitionHolder = new BeanDefinitionHolder(annotatedBeanDefinition, "tomcatEmbeddedServletContainerFactory");
            BeanDefinitionReaderUtils.registerBeanDefinition(beanDefinitionHolder, beanDefinitionRegistry);
        }
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory configurableListableBeanFactory) throws BeansException {}


    @Override
    public void setEnvironment(Environment environment) {
        profile = environment.getProperty("profile");
    }
}
```

##### 　　注意上面的注入对象是`HttpsTomcatEmbeddedServletContainerFactory`，不是之前的`TomcatEmbeddedServletContainerFactory`，贴上`HttpsTomcatEmbeddedServletContainerFactory`代码：

```java
import org.apache.catalina.connector.Connector;
import org.apache.coyote.http11.Http11NioProtocol;
import org.springframework.boot.context.embedded.tomcat.TomcatEmbeddedServletContainerFactory;

/**
 * @author winx
 * @create 2017-09-01.
 */
public class HttpsTomcatEmbeddedServletContainerFactory extends TomcatEmbeddedServletContainerFactory {

    public HttpsTomcatEmbeddedServletContainerFactory() {
        super();
        Connector connector = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        Http11NioProtocol protocol = (Http11NioProtocol) connector.getProtocolHandler();
        connector.setScheme("https");
        connector.setSecure(true);
        connector.setPort(8443);
        protocol.setSSLEnabled(true);
        protocol.setKeystoreFile("/Users/winx/.keystore");
        protocol.setKeystorePass("123456");
        protocol.setTruststoreFile("/Users/winx/.keystore");
        protocol.setTruststorePass("123456");
        protocol.setKeyAlias("tomcat");
        addAdditionalTomcatConnectors(connector);
    }
}
```

##### 成功的解决了之前属性设置问题。