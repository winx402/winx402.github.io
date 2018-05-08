---
layout: post
title: spring ioc容器初始化流程
date: 2018/04/15
tags: [hide]
original: true
tag: [[spring, spring],[java, java]]
---

##### IOC容器是Spring的核心之一，就是具有依赖注入功能的容器，IOC容器负责实例化、定位、配置应用程序中的对象及建立这些对象间的依赖。应用程序无需在代码中new相关的对象，应用程序由IOC容器进行组装。具体的Spring和IOC的功能要点这里不做详细介绍，本文的重点将是围绕IOC的创建流程去发现和学习Spring的核心原理。
<!--more-->

## 介绍
##### Ioc容器的初始化是由refresh（）方法来启动的，这个方法标志着Ioc容器的正式启动。具体来说这个启动过程包括三个基本过程：
1. BeanDifinition的Resource定位
2. BeanDifinition的载入与解析
3. BeanDifinition在Ioc容器中的注册

##### 需要注意的是，Spring把这三个过程分开，并使用不同的模块来完成，如使用相应的ResourceLoader、BeanDifinitionReader等模块，通过这样的实际方式，可以让用户更加灵活的对这三个过程进行剪裁和扩展。
##### 这些过程都是在AbstractApplicationContext中的refresh()方法中完成的
```java
public void refresh() throws BeansException, IllegalStateException {
		synchronized (this.startupShutdownMonitor) {
			// 准备工作
			prepareRefresh();

			// 通过子类创建beanFactory
			ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

			// beanFactory的准备工作
			prepareBeanFactory(beanFactory);

			try {
				// 设置beanFactory的后置处理
				postProcessBeanFactory(beanFactory);

				// 调用beanFactory的后处理器，这些后处理器是在Bean定义中向容器注册的
				invokeBeanFactoryPostProcessors(beanFactory);

				// 注册Bean的后处理器，在Bean创建过程中调用
				registerBeanPostProcessors(beanFactory);

				// 初始化上下文中的消息源
				initMessageSource();

				// 初始化时间机制
				initApplicationEventMulticaster();

				// 初始化其他特殊Bean
				onRefresh();

				// 检查监听Bean并且将这些Bean向容器注册
				registerListeners();

				// 实例化所有non-lazy-init组件
				finishBeanFactoryInitialization(beanFactory);

				// 发布容器事件，结束初始化流程
				finishRefresh();
			}

			catch (BeansException ex) {
				if (logger.isWarnEnabled()) {
					logger.warn("Exception encountered during context initialization - " +
							"cancelling refresh attempt: " + ex);
				}

				// 为防止Bean资源占用，如果出现异常，销毁已经在前面过程中生成的单元Bean
				destroyBeans();

				// 重置 'active' 标志.
				cancelRefresh(ex);

				throw ex;
			}

			finally {
				resetCommonCaches();
			}
		}
	}
```

## 源码解析
##### 首先来看下BeanFactory的创建

### 创建beanFactory：obtainFreshBeanFactory()
```java
protected ConfigurableListableBeanFactory obtainFreshBeanFactory() {
	refreshBeanFactory();
	ConfigurableListableBeanFactory beanFactory = getBeanFactory();
	if (logger.isDebugEnabled()) {
		logger.debug("Bean factory for " + getDisplayName() + ": " + beanFactory);
	}
	return beanFactory;
}
```

##### obtainFreshBeanFactory()方法获取的是ConfigurableListableBeanFactory，这里的操作很简单，refreshBeanFactory创建BeanFactory，然后获取并返回。让我们继续看下refreshBeanFactory():
```java
protected abstract void refreshBeanFactory() throws BeansException, IllegalStateException;
```
##### 抽象方法，看下AbstractRefreshableApplicationContext中的实现：
```java
protected final void refreshBeanFactory() throws BeansException {
	if (hasBeanFactory()) {
	    //如果BeanFactory已经被创建，则销毁并关闭它
		destroyBeans();
		closeBeanFactory();
	}
	try {
	    //创建DefaultListableBeanFactory
		DefaultListableBeanFactory beanFactory = createBeanFactory(); 
		beanFactory.setSerializationId(getId());
		//属性继承
		customizeBeanFactory(beanFactory);
		//载入BeanDefinitions
		loadBeanDefinitions(beanFactory);
		synchronized (this.beanFactoryMonitor) {
			this.beanFactory = beanFactory;
		}
	}
	catch (IOException ex) {
		throw new ApplicationContextException("I/O error parsing bean definition source for " + getDisplayName(), ex);
	}
}
```
#### createBeanFactory():
```java
protected DefaultListableBeanFactory createBeanFactory() {
	return new DefaultListableBeanFactory(getInternalParentBeanFactory());
}
``` 
##### 实例化一个DefaultListableBeanFactory并设置其父BeanFactory，看下getInternalParentBeanFactory():
```java
protected BeanFactory getInternalParentBeanFactory() {
	return (getParent() instanceof ConfigurableApplicationContext) ?
			((ConfigurableApplicationContext) getParent()).getBeanFactory() : getParent();
}
```

#### customizeBeanFactory(beanFactory)
```java
protected void customizeBeanFactory(DefaultListableBeanFactory beanFactory) {
	if (this.allowBeanDefinitionOverriding != null) {
		beanFactory.setAllowBeanDefinitionOverriding(this.allowBeanDefinitionOverriding);
	}
	if (this.allowCircularReferences != null) {
		beanFactory.setAllowCircularReferences(this.allowCircularReferences);
	}
}
```
##### 继承容器的属性设置：
1. allowBeanDefinitionOverriding：当不同文件中配置了相同id或者name的同一类型的两个bean时，是否允许覆盖
2. allowCircularReferences：是否允许循环引用

#### loadBeanDefinitions(DefaultListableBeanFactory):
```java
protected abstract void loadBeanDefinitions(DefaultListableBeanFactory beanFactory) throws BeansException, IOException;
```

##### 抽象方法，我们以XmlWebApplicationContext作为例子看下实现的过程
```java
protected void loadBeanDefinitions(DefaultListableBeanFactory beanFactory) throws BeansException, IOException {
	// 根据beanFactory创建新的XmlBeanDefinitionReader
	XmlBeanDefinitionReader beanDefinitionReader = new XmlBeanDefinitionReader(beanFactory);
	beanDefinitionReader.setEnvironment(this.getEnvironment());
	beanDefinitionReader.setResourceLoader(this);
	beanDefinitionReader.setEntityResolver(new ResourceEntityResolver(this));
	initBeanDefinitionReader(beanDefinitionReader);
	loadBeanDefinitions(beanDefinitionReader);
}
```

##### 直接看最后的loadBeanDefinitions(XmlBeanDefinitionReader):
```java
protected void loadBeanDefinitions(XmlBeanDefinitionReader reader) throws IOException {
    //加载配置地址
	String[] configLocations = getConfigLocations();
	if (configLocations != null) {
		for (String configLocation : configLocations) {
			reader.loadBeanDefinitions(configLocation);
		}
	}
}
```

##### 根据地址循环载入BeanDefinition：
```java
public int loadBeanDefinitions(String location) throws BeanDefinitionStoreException {
	return loadBeanDefinitions(location, null);
}
```
##### 真正的执行过程：
```java
public int loadBeanDefinitions(String location, Set<Resource> actualResources) throws BeanDefinitionStoreException {
    //获取resourceLoader
	ResourceLoader resourceLoader = getResourceLoader();
	if (resourceLoader == null) {
		throw new BeanDefinitionStoreException(
				"Cannot import bean definitions from location [" + location + "]: no ResourceLoader available");
	}
	if (resourceLoader instanceof ResourcePatternResolver) {
		// Resource pattern matching available.
		try {
		    //定位资源
			Resource[] resources = ((ResourcePatternResolver) resourceLoader).getResources(location);
			int loadCount = loadBeanDefinitions(resources);
			if (actualResources != null) {
				for (Resource resource : resources) {
					actualResources.add(resource);
				}
			}
			if (logger.isDebugEnabled()) {
				logger.debug("Loaded " + loadCount + " bean definitions from location pattern [" + location + "]");
			}
			return loadCount;
		}
		catch (IOException ex) {
			throw new BeanDefinitionStoreException(
					"Could not resolve bean definition resource pattern [" + location + "]", ex);
		}
	}
	else {
		// Can only load single resources by absolute URL.
		Resource resource = resourceLoader.getResource(location);
		int loadCount = loadBeanDefinitions(resource);
		if (actualResources != null) {
			actualResources.add(resource);
		}
		if (logger.isDebugEnabled()) {
			logger.debug("Loaded " + loadCount + " bean definitions from location [" + location + "]");
		}
		return loadCount;
	}
}
```
##### 具体的执行流程这里不做结束，总之Spring在加载BeanFactory之后，通过factory去载入了BeanDefinition

##

