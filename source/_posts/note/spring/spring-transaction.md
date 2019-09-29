---
layout: post
title: Spring事务解析过程分析
date: 2019/09/18
tags: [tech, index, spring, java]
original: true
tag: [[spring, spring],[java, java]]
---

##### spring支持编程式事务管理和声明式事务管理两种方式。编程式事务管理使用TransactionTemplate或者直接使用底层的PlatformTransactionManager；申明式事务管理=编程式事务管理+aop，在已有的编程式事务实现的基础上，用aop进行代理、拦截、事务处理，实现配置化的事务管理，因为只需要在配置文件中做相关的事务规则声明(或通过基于`@Transactional`注解的方式)，便可以将事务规则应用到业务逻辑中，因此叫做声明式事务管理。
<!--more-->

##### 声明式事务管理建立在AOP之上的。其本质是对方法前后进行拦截，然后在目标方法开始之前创建或者加入一个事务，在执行完目标方法之后根据执行情况提交或者回滚事务。声明式事务最大的优点就是不需要通过编程的方式管理事务，这样就不需要在业务逻辑代码中掺杂事务管理的代码，只需在配置文件中做相关的事务规则声明(或通过基于@Transactional注解的方式)，便可以将事务规则应用到业务逻辑中。

## 问题
##### 本着带着问题出发寻找答案，首先回顾一个在之前项目中遇到的事务问题：在申明式事务管理中，比较常见的一种申明方式是基于`@Transactional`注解。那么在一个方法上申明两个不同数据源的注解，如下形式：
```java
@Transactional(value = "aTransactionManager", rollbackFor = Exception.class)
@Transactional(value = "bTransactionManager", rollbackFor = Exception.class)
public void doSomething() {
    //do something in datasource a
    //do something in datasource b
}
```
##### `aTransactionManager`管理数据源a，`bTransactionManager`管理着数据源b。在`doSomething()`函数中，同时会操作数据源a和b。
##### 那么，当`doSomething()`中抛出异常后，两个不同的事务管理器是否能够对多个数据源同时进行事务处理呢？答案是否定的，实际操作发现`aTransactionManager`触发了回滚动作，但是`bTransactionManager`下的数据源并没有回滚。所以这是什么原因呢。

## 最初的想法
##### 在分析spring事务的处理过程之前，首先想说说为什么我会觉得上面的方式是行得通的。通常来说事务的处理流程大致如下过程：
```java
public Object invoke(final MethodInvocation invocation) throws Throwable {
	try { 
        utx.begin(); // 事务开始
        businessLogic(); //业务执行过程
        utx.commit();  //事务提交
    } catch(Exception ex) { 
        utx.rollback(); //异常回滚
        throw ex;  //异常抛出
    }
}
```
##### 事务过程如注解所示，整个执行流程被try catch块包裹，正常执行情况下事务通过`commit()`提交，当catch到异常情况，通过`rollback()`进行事务回滚。`commit()`和`rollback()`都会使事务结束。

#### 当我们使用两个注解的时候，难道不应该是下面的这种情况吗？
##### 1、多层代理
```java
public Object invoke(final MethodInvocation invocation) throws Throwable {
	try { 
        autx.begin(); // 事务a开始
        try { 
            butx.begin(); // 事务b开始
            businessLogic(); //业务执行过程
            butx.commit();  //事务b提交
        } catch(Exception ex) { 
            butx.rollback(); //事务b异常回滚
            throw ex;  //异常抛出
        }
        autx.commit();  //事务a提交
    } catch(Exception ex) { 
        autx.rollback(); //事务a异常回滚
        throw ex;  //异常抛出
    }
}
```
##### 或者
##### 1、单层代理
```java
public Object invoke(final MethodInvocation invocation) throws Throwable {
	try { 
        autx.begin(); // 事务a开始
        butx.begin(); // 事务b开始
        businessLogic(); //业务执行过程
        autx.commit();  //事务a提交
        butx.commit();  //事务b提交
    } catch(Exception ex) { 
        autx.rollback(); //事务a异常回滚
        butx.rollback(); //事务b异常回滚
        throw ex;  //异常抛出
    }
}
```
##### 这当然是想当然的，结果在前面已经说过，只有一个事务是生效的，那么为什么会是这样呢，下面我就来分析spring申明式事务的解析和执行过程。

## Spring申明式事务解析过程
### 事务的三大接口
1. PlatformTransactionManager 事务管理器
2. TransactionDefinition 事务的一些基础信息，如超时时间、隔离级别、传播属性等
3. TransactionStatus 事务的一些状态信息，如是否一个新的事务、是否已被标记为回滚

#### PlatformTransactionManager
```java
public interface PlatformTransactionManager {
    /**
     * 根据事务定义TransactionDefinition，获取事务
     */
	TransactionStatus getTransaction(TransactionDefinition definition) throws TransactionException;
	
	/**
     * 事务提交
     */
	void commit(TransactionStatus status) throws TransactionException;
	
	/**
     * 事务回滚
     */
	void rollback(TransactionStatus status) throws TransactionException;
	
}
```
#### TransactionDefinition
```
public interface TransactionDefinition {

	int PROPAGATION_REQUIRED = 0;

	int PROPAGATION_SUPPORTS = 1;

	int PROPAGATION_MANDATORY = 2;

	int PROPAGATION_REQUIRES_NEW = 3;

	int PROPAGATION_NOT_SUPPORTED = 4;

	int PROPAGATION_NEVER = 5;

	int PROPAGATION_NESTED = 6;

	int ISOLATION_DEFAULT = -1;

	int ISOLATION_READ_UNCOMMITTED = Connection.TRANSACTION_READ_UNCOMMITTED;

	int ISOLATION_READ_COMMITTED = Connection.TRANSACTION_READ_COMMITTED;

	int ISOLATION_REPEATABLE_READ = Connection.TRANSACTION_REPEATABLE_READ;

	int ISOLATION_SERIALIZABLE = Connection.TRANSACTION_SERIALIZABLE;

	int TIMEOUT_DEFAULT = -1;

	int getPropagationBehavior();

	int getIsolationLevel();

	int getTimeout();

	boolean isReadOnly();

	String getName();

}
```
#### TransactionStatus
```
public interface TransactionStatus extends SavepointManager, Flushable {

	boolean isNewTransaction();

	boolean hasSavepoint();

	void setRollbackOnly();

	boolean isRollbackOnly();

	@Override
	void flush();

	boolean isCompleted();

}
```
### 事务的加载过程
##### 要了解spring申明式事务的加载过程，就必须了解Aop的加载过程。此处略过Aop的解析、加载过程叙述，让我们直接来看`tx:annotation-driven`标签的解析类`org.springframework.transaction.config.AnnotationDrivenBeanDefinitionParser`。
```java
/**
 * 解析过程
 */
public BeanDefinition parse(Element element, ParserContext parserContext) {
	registerTransactionalEventListenerFactory(parserContext);
	String mode = element.getAttribute("mode");
	if ("aspectj".equals(mode)) {
		// mode="aspectj"
		registerTransactionAspect(element, parserContext);
	}
	else {
		// mode="proxy"
		AopAutoProxyConfigurer.configureAutoProxyCreator(element, parserContext);
	}
	return null;
}
```
##### 通常我们都是`proxy`模式，这里使用了内部类`AopAutoProxyConfigurer`的静态方法`configureAutoProxyCreator`进行解析：
```java
public static void configureAutoProxyCreator(Element element, ParserContext parserContext) {
    //1.启用Spring AOP功能
	AopNamespaceUtils.registerAutoProxyCreatorIfNecessary(parserContext, element);
	String txAdvisorBeanName = TransactionManagementConfigUtils.TRANSACTION_ADVISOR_BEAN_NAME;
	if (!parserContext.getRegistry().containsBeanDefinition(txAdvisorBeanName)) {
		Object eleSource = parserContext.extractSource(element);
		//2. 向Spring注入解析@Transactional注解的处理类
		RootBeanDefinition sourceDef = new RootBeanDefinition(
				"org.springframework.transaction.annotation.AnnotationTransactionAttributeSource");
		sourceDef.setSource(eleSource);
		sourceDef.setRole(BeanDefinition.ROLE_INFRASTRUCTURE);
		String sourceName = parserContext.getReaderContext().registerWithGeneratedName(sourceDef);
		// 3.向Spring注入处理@Transactional注解的advice.
		RootBeanDefinition interceptorDef = new RootBeanDefinition(TransactionInterceptor.class);
		interceptorDef.setSource(eleSource);
		interceptorDef.setRole(BeanDefinition.ROLE_INFRASTRUCTURE);
		registerTransactionManager(element, interceptorDef);
		interceptorDef.getPropertyValues().add("transactionAttributeSource", new RuntimeBeanReference(sourceName));
		String interceptorName = parserContext.getReaderContext().registerWithGeneratedName(interceptorDef);
		// 4.向Spring注入事务的advisor
		RootBeanDefinition advisorDef = new RootBeanDefinition(BeanFactoryTransactionAttributeSourceAdvisor.class);
		advisorDef.setSource(eleSource);
		advisorDef.setRole(BeanDefinition.ROLE_INFRASTRUCTURE);
		advisorDef.getPropertyValues().add("transactionAttributeSource", new RuntimeBeanReference(sourceName));
		advisorDef.getPropertyValues().add("adviceBeanName", interceptorName);
		if (element.hasAttribute("order")) {
			advisorDef.getPropertyValues().add("order", element.getAttribute("order"));
		}
		parserContext.getRegistry().registerBeanDefinition(txAdvisorBeanName, advisorDef);
		CompositeComponentDefinition compositeDef = new CompositeComponentDefinition(element.getTagName(), eleSource);
		compositeDef.addNestedComponent(new BeanComponentDefinition(sourceDef, sourceName));
		compositeDef.addNestedComponent(new BeanComponentDefinition(interceptorDef, interceptorName));
		compositeDef.addNestedComponent(new BeanComponentDefinition(advisorDef, txAdvisorBeanName));
		parserContext.registerComponent(compositeDef);
	}
}
```
#### 首先让我们来看看`AnnotationTransactionAttributeSource`，该类继承了`TransactionAttributeSource`
```java
public interface TransactionAttributeSource {

	/**
	 * Return the transaction attribute for the given method,
	 * or {@code null} if the method is non-transactional.
	 * @param method the method to introspect
	 * @param targetClass the target class. May be {@code null},
	 * in which case the declaring class of the method must be used.
	 * @return TransactionAttribute the matching transaction attribute,
	 * or {@code null} if none found
	 */
	TransactionAttribute getTransactionAttribute(Method method, Class<?> targetClass);

}
```
#### 通过注解我们知道，`getTransactionAttribute`方法会返回类或方法的事务属性。最终，我们找到了获取`TransactionAttribute`的执行方法。
```java
/**
* Determine the transaction attribute for the given method or class.
* <p>This implementation delegates to configured
* {@link TransactionAnnotationParser TransactionAnnotationParsers}
* for parsing known annotations into Spring's metadata attribute class.
* Returns {@code null} if it's not transactional.
* <p>Can be overridden to support custom annotations that carry transaction metadata.
* @param element the annotated method or class
* @return the configured transaction attribute, or {@code null} if none was found
*/
rotected TransactionAttribute determineTransactionAttribute(AnnotatedElement element) {
	if (element.getAnnotations().length > 0) {
		for (TransactionAnnotationParser annotationParser : this.annotationParsers) {
			TransactionAttribute attr = annotationParser.parseTransactionAnnotation(element);
			if (attr != null) {
				return attr;
			}
		}
	}
	return null;
}
```
##### `TransactionAnnotationParser`是事务注解的解析类，`AnnotationTransactionAttributeSource`中默认添加了3种解析方式。让我们看看其中`SpringTransactionAnnotationParser`的执行过程`parseTransactionAnnotation`
```java
@Override
public TransactionAttribute parseTransactionAnnotation(AnnotatedElement element) {
	AnnotationAttributes attributes = AnnotatedElementUtils.getMergedAnnotationAttributes(
			element, Transactional.class);
	if (attributes != null) {
		return parseTransactionAnnotation(attributes);
	}
	else {
		return null;
	}
}
```
##### `getMergedAnnotationAttributes`方法支持注解属性覆盖，如果一个方法上注册了两个`@Transactional`，也只会返回其中一个。这就是为什么两个注解不能同时生效。

### 事务处理过程
##### 前面已经看到了，事务的拦截类`TransactionInterceptor`，让我们看看`invoke`方法
```java
@Override
public Object invoke(final MethodInvocation invocation) throws Throwable {
	// Work out the target class: may be {@code null}.
	// The TransactionAttributeSource should be passed the target class
	// as well as the method, which may be from an interface.
	Class<?> targetClass = (invocation.getThis() != null ? AopUtils.getTargetClass(invocation.getThis()) : null);

	// Adapt to TransactionAspectSupport's invokeWithinTransaction...
	return invokeWithinTransaction(invocation.getMethod(), targetClass, new InvocationCallback() {
		@Override
		public Object proceedWithInvocation() throws Throwable {
			return invocation.proceed();
		}
	});
}
```
##### 其中`proceedWithInvocation`是业务的正常处理流程，该流程被包裹在了事务的执行方法`invokeWithinTransaction`中：
```java
protected Object invokeWithinTransaction(Method method, Class<?> targetClass, final InvocationCallback invocation)
		throws Throwable {

	//获取TransactionAttribute，如果TransactionAttribute是空，则该方法不执行事务
	final TransactionAttribute txAttr = getTransactionAttributeSource().getTransactionAttribute(method, targetClass);
	//获取事务管理器
	final PlatformTransactionManager tm = determineTransactionManager(txAttr);
	final String joinpointIdentification = methodIdentification(method, targetClass, txAttr);

	if (txAttr == null || !(tm instanceof CallbackPreferringPlatformTransactionManager)) {
		// 事务标准
		TransactionInfo txInfo = createTransactionIfNecessary(tm, txAttr, joinpointIdentification);
		Object retVal = null;
		try {
			// This is an around advice: Invoke the next interceptor in the chain.
			// This will normally result in a target object being invoked.
			retVal = invocation.proceedWithInvocation();
		}
		catch (Throwable ex) {
			// target invocation exception
			completeTransactionAfterThrowing(txInfo, ex);
			throw ex;
		}
		finally {
			cleanupTransactionInfo(txInfo);
		}
		commitTransactionAfterReturning(txInfo);
		return retVal;
	}

	else {
		final ThrowableHolder throwableHolder = new ThrowableHolder();

		// It's a CallbackPreferringPlatformTransactionManager: pass a TransactionCallback in.
		try {
			Object result = ((CallbackPreferringPlatformTransactionManager) tm).execute(txAttr,
					new TransactionCallback<Object>() {
						@Override
						public Object doInTransaction(TransactionStatus status) {
							TransactionInfo txInfo = prepareTransactionInfo(tm, txAttr, joinpointIdentification, status);
							try {
								return invocation.proceedWithInvocation();
							}
							catch (Throwable ex) {
								if (txAttr.rollbackOn(ex)) {
									// A RuntimeException: will lead to a rollback.
									if (ex instanceof RuntimeException) {
										throw (RuntimeException) ex;
									}
									else {
										throw new ThrowableHolderException(ex);
									}
								}
								else {
									// A normal return value: will lead to a commit.
									throwableHolder.throwable = ex;
									return null;
								}
							}
							finally {
								cleanupTransactionInfo(txInfo);
							}
						}
					});

			// Check result state: It might indicate a Throwable to rethrow.
			if (throwableHolder.throwable != null) {
				throw throwableHolder.throwable;
			}
			return result;
		}
		catch (ThrowableHolderException ex) {
			throw ex.getCause();
		}
		catch (TransactionSystemException ex2) {
			if (throwableHolder.throwable != null) {
				logger.error("Application exception overridden by commit exception", throwableHolder.throwable);
				ex2.initApplicationException(throwableHolder.throwable);
			}
			throw ex2;
		}
		catch (Throwable ex2) {
			if (throwableHolder.throwable != null) {
				logger.error("Application exception overridden by commit exception", throwableHolder.throwable);
			}
			throw ex2;
		}
	}
}
```
##### 依据`PlatformTransactionManager`的实现，执行了不同的事务流程，但是可以看到两种方式都是around的形式进行代理。



