---
layout: post
title: dubbo-动态代理实现
date: 2018/03/22
tags: [tech, index, dubbo]
tag: [[java, java], [dubbo, dubbo]]
---

##### 　　动态代理对于dubbo来说不是必须的，没有代理实现，dubbo一样可以运行。但是dubbo的一个重要的特点就是调用远程服务就像调用本地服务一样的方便。这其中对于其调用过程的隐藏就是通过动态代理来实现的。动态代理本身就就不详细介绍了，可以参考之前的一篇文章：[java动态代理实现](https://winx402.github.io/note/javaDynamicProxy/)

<!--more-->

### 扩展接口：
##### `com.alibaba.dubbo.rpc.ProxyFactory`

### 使用配置:
```xml
<dubbo:consumer proxy="" />
<dubbo:provider proxy="" />
```

### 目前已知扩展：
* stub=com.alibaba.dubbo.rpc.proxy.wrapper.StubProxyFactoryWrapper
* jdk=com.alibaba.dubbo.rpc.proxy.jdk.JdkProxyFactory
* javassist=com.alibaba.dubbo.rpc.proxy.javassist.JavassistProxyFactory

### 包结构：
![](/img/note/dubbo/dubbo1.png)

### ProxyFactory
```java
@SPI("javassist") //默认使用javassist
public interface ProxyFactory {

    /**
     * 通过Invoker创建代理
     *
     * @param invoker dubbo的可执行单元
     * @return proxy java代理对象
     */
    @Adaptive({Constants.PROXY_KEY})
    <T> T getProxy(Invoker<T> invoker) throws RpcException;

    /**
     * 创建 invoker.
     *
     * @param <T>
     * @param proxy
     * @param type
     * @param url
     * @return invoker
     */
    @Adaptive({Constants.PROXY_KEY})
    <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) throws RpcException;
}
```

### AbstractProxyFactory
##### **AbstractProxyFactory**实现了之前的**ProxyFactory**接口以及其方法getProxy的通用实现
```java
public abstract class AbstractProxyFactory implements ProxyFactory {

    public <T> T getProxy(Invoker<T> invoker) throws RpcException {
        Class<?>[] interfaces = null;
        String config = invoker.getUrl().getParameter("interfaces");
        if (config != null && config.length() > 0) {
            String[] types = Constants.COMMA_SPLIT_PATTERN.split(config);
            if (types != null && types.length > 0) {
                interfaces = new Class<?>[types.length + 2];
                interfaces[0] = invoker.getInterface();
                interfaces[1] = EchoService.class;
                for (int i = 0; i < types.length; i++) {
                    interfaces[i + 1] = ReflectUtils.forName(types[i]);
                }
            }
        }
        if (interfaces == null) {
            interfaces = new Class<?>[]{invoker.getInterface(), EchoService.class};
        }
        return getProxy(invoker, interfaces);
    }

    public abstract <T> T getProxy(Invoker<T> invoker, Class<?>[] types);
}
```
##### getProxy方法主要是将该代理需要实现的接口给确定好，该接口存储在invoker对象的url的interfaces参数中，是一个字符串，用逗号分隔，我们不需要关心interfaces中存储的到底是哪些接口，只需要知道的是，invoker.getInterface()和EchoService.class会加入到其中，而另一个重载的getProxy方法显然是丢给子类来实现了。

## jdk实现方式
```java
/**
 * JdkProxyFactory
 * 继承了AbstractProxyFactory
 */
public class JdkProxyFactory extends AbstractProxyFactory {

    @SuppressWarnings("unchecked")
    public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.newProxyInstance(Thread.currentThread().getContextClassLoader(), interfaces, new InvokerInvocationHandler(invoker));
    }

    public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                Method method = proxy.getClass().getMethod(methodName, parameterTypes);
                return method.invoke(proxy, arguments);
            }
        };
    }

}
```

##### JdkProxyFactory继承了AbstractProxyFactory，并实现了其抽象方法

### getProxy
```java
public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.newProxyInstance(Thread.currentThread().getContextClassLoader(), interfaces, new InvokerInvocationHandler(invoker));
    }
```
##### 对，这里直接使用了jdk的Proxy类来创建代理对象。这里的关键在于InvokerInvocationHandler的实现：
```java
public class InvokerInvocationHandler implements InvocationHandler {

    private final Invoker<?> invoker; //实际执行对象

    //通过Invoker初始化
    public InvokerInvocationHandler(Invoker<?> handler) {
        this.invoker = handler;
    }

    //代理调用的实际过程
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        String methodName = method.getName(); //获取方法名
        Class<?>[] parameterTypes = method.getParameterTypes(); //方法参数类型
        if (method.getDeclaringClass() == Object.class) {
            //判断方法是不是属于Object类的方法。比如getClass、clone、notify等方法。如果是的话直接委托给invoker本身去执行。
            return method.invoke(invoker, args);
        }
        if ("toString".equals(methodName) && parameterTypes.length == 0) {
            //如果重写了toString方法。则调用invoker的toString
            return invoker.toString();
        }
        if ("hashCode".equals(methodName) && parameterTypes.length == 0) {
            //如果重写了hashCode方法。则调用invoker的hashCode
            return invoker.hashCode();
        }
        if ("equals".equals(methodName) && parameterTypes.length == 1) {
            //如果重写了equals方法。则调用invoker的equals
            return invoker.equals(args[0]);
        }
        //否则，通过method和args创建一个RpcInvocation。通过该Invocation去执行invoker调用。并且返回调用结果
        return invoker.invoke(new RpcInvocation(method, args)).recreate();
    }

}
```

##### 可以看到，jdk的实现方式很简单，只是将实际执行对象由我们平时的实际类指向了invoker

### getInvoker
```java
public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                Method method = proxy.getClass().getMethod(methodName, parameterTypes);
                return method.invoke(proxy, arguments);
            }
        };
    }
```

##### getInvoker方法通过实际执行方法和类去创建一个Invoker。JDK实现方式是创建一个匿名AbstractProxyInvoker类，并实现其doInvoke方法。doInvoke方法中通过反射获取到目标方法。然后再通过反射去执行。

##### 查看AbstractProxyInvoker类，会发现doInvoke是invoke的实际实现。因此对于代理的整个初始化流程：
1. 拿到实际执行对象，通过该对象去创建Invoker
2. 通过Invoker再去创建代理对象

## javassist实现方式
```java
public class JavassistProxyFactory extends AbstractProxyFactory {

    @SuppressWarnings("unchecked")
    public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.getProxy(interfaces).newInstance(new InvokerInvocationHandler(invoker));
    }

    public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        // TODO Wrapper cannot handle this scenario correctly: the classname contains '$'
        final Wrapper wrapper = Wrapper.getWrapper(proxy.getClass().getName().indexOf('$') < 0 ? proxy.getClass() : type);
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                return wrapper.invokeMethod(proxy, methodName, parameterTypes, arguments);
            }
        };
    }

}
```
### getProxy
```java
public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.getProxy(interfaces).newInstance(new InvokerInvocationHandler(invoker));
    }
```

##### 和jdk的生成方式差不多，但是这里的Proxy不是jdk自带的类，而是**com.alibaba.dubbo.common.bytecode.Proxy**，该类的主要作用就是通过javassist的字节码技术去动态的创建代理类，下面我们来看下该类的主要实现方法：
```java
public static Proxy getProxy(ClassLoader cl, Class<?>... ics) {
        if (ics.length > 65535)
            throw new IllegalArgumentException("interface limit exceeded");

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ics.length; i++) {
            String itf = ics[i].getName();
            if (!ics[i].isInterface())
                throw new RuntimeException(itf + " is not a interface.");

            Class<?> tmp = null;
            try {
                tmp = Class.forName(itf, false, cl);
            } catch (ClassNotFoundException e) {
            }

            if (tmp != ics[i])
                throw new IllegalArgumentException(ics[i] + " is not visible from class loader");

            sb.append(itf).append(';');
        }

        // use interface class name list as key.
        String key = sb.toString();

        // get cache by class loader.
        Map<String, Object> cache;
        synchronized (ProxyCacheMap) {
            cache = ProxyCacheMap.get(cl);
            if (cache == null) {
                cache = new HashMap<String, Object>();
                ProxyCacheMap.put(cl, cache);
            }
        }

        Proxy proxy = null;
        synchronized (cache) {
            do {
                Object value = cache.get(key);
                if (value instanceof Reference<?>) {
                    proxy = (Proxy) ((Reference<?>) value).get();
                    if (proxy != null)
                        return proxy;
                }

                if (value == PendingGenerationMarker) {
                    try {
                        cache.wait();
                    } catch (InterruptedException e) {
                    }
                } else {
                    cache.put(key, PendingGenerationMarker);
                    break;
                }
            }
            while (true);
        }

        long id = PROXY_CLASS_COUNTER.getAndIncrement();
        String pkg = null;
        ClassGenerator ccp = null, ccm = null;
        try {
            ccp = ClassGenerator.newInstance(cl);

            Set<String> worked = new HashSet<String>();
            List<Method> methods = new ArrayList<Method>();

            for (int i = 0; i < ics.length; i++) {
                if (!Modifier.isPublic(ics[i].getModifiers())) {
                    String npkg = ics[i].getPackage().getName();
                    if (pkg == null) {
                        pkg = npkg;
                    } else {
                        if (!pkg.equals(npkg))
                            throw new IllegalArgumentException("non-public interfaces from different packages");
                    }
                }
                ccp.addInterface(ics[i]);

                for (Method method : ics[i].getMethods()) {
                    String desc = ReflectUtils.getDesc(method);
                    if (worked.contains(desc))
                        continue;
                    worked.add(desc);

                    int ix = methods.size();
                    Class<?> rt = method.getReturnType();
                    Class<?>[] pts = method.getParameterTypes();

                    StringBuilder code = new StringBuilder("Object[] args = new Object[").append(pts.length).append("];");
                    for (int j = 0; j < pts.length; j++)
                        code.append(" args[").append(j).append("] = ($w)$").append(j + 1).append(";");
                    code.append(" Object ret = handler.invoke(this, methods[" + ix + "], args);");
                    if (!Void.TYPE.equals(rt))
                        code.append(" return ").append(asArgument(rt, "ret")).append(";");

                    methods.add(method);
                    ccp.addMethod(method.getName(), method.getModifiers(), rt, pts, method.getExceptionTypes(), code.toString());
                }
            }

            if (pkg == null)
                pkg = PACKAGE_NAME;

            // create ProxyInstance class.
            String pcn = pkg + ".proxy" + id;
            ccp.setClassName(pcn);
            ccp.addField("public static java.lang.reflect.Method[] methods;");
            ccp.addField("private " + InvocationHandler.class.getName() + " handler;");
            ccp.addConstructor(Modifier.PUBLIC, new Class<?>[]{InvocationHandler.class}, new Class<?>[0], "handler=$1;");
            ccp.addDefaultConstructor();
            Class<?> clazz = ccp.toClass();
            clazz.getField("methods").set(null, methods.toArray(new Method[0]));

            // create Proxy class.
            String fcn = Proxy.class.getName() + id;
            ccm = ClassGenerator.newInstance(cl);
            ccm.setClassName(fcn);
            ccm.addDefaultConstructor();
            ccm.setSuperClass(Proxy.class);
            ccm.addMethod("public Object newInstance(" + InvocationHandler.class.getName() + " h){ return new " + pcn + "($1); }");
            Class<?> pc = ccm.toClass();
            proxy = (Proxy) pc.newInstance();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage(), e);
        } finally {
            // release ClassGenerator
            if (ccp != null)
                ccp.release();
            if (ccm != null)
                ccm.release();
            synchronized (cache) {
                if (proxy == null)
                    cache.remove(key);
                else
                    cache.put(key, new WeakReference<Proxy>(proxy));
                cache.notifyAll();
            }
        }
        return proxy;
    }
```

##### 该方法通过ClassLoader和Class接口生成一个Proxy类（注意是Proxy类，而不是之前的getProxy的泛型T类，实际上该Proxy就是该方法所处的类） 代码比较长，以下它的实现过程：
1. 遍历所有入参接口，以;分割连接起来，以它为key以map为缓存查找如果有，说明代理对象已创建返回
2. 利用AtomicLong对象自增获取一个long数组来作为生产类的后缀，防止冲突
3. 遍历接口获取所有定义的方法
    1. 将方法签名解析成字符串，加入到一个集合Set<String> worked中 ，用来判重
    2. 获取方法应该在methods数组中的索引下标ix
    3. 获取方法的参数类型以及返回类型
    4. 构建方法体return ret= handler.invoke(this, methods[ix], args);这里的方法调用其实是委托给InvokerInvocationHandler实例对象的，去调用真正的实例
    5. 方法加入到methods数组中；将字符串构建的方法加入到代理类中
4. 创建代理实例对象ProxyInstance
    1. 类名为  pkg + “.poxy”+id = 包名 + “.poxy” +自增数值
    2. 添加静态字段Method[] methods; 保存了该代理类代理的所有方法。在代理方法体中直接通过数组下表ix来获取方法
    3. 添加实例对象InvocationHandler handler；代理实际上就是将方法的的执行给了handler。该handler的实现和jdk中的handler是同一个。
    4. 创建构造函数，构造函数的参数就是上面的InvocationHandler
    5. 添加默认构造函数
    6. 利用工具类ClassGenerator生成对应的字节码
5. 创建代理对象，它的newInstance(handler)方法用来创建基于我们接口的代理
    1. 代理对象名Proxy + id
    2. 添加默认构造器
    3. 实现方法newInstance代码，return new pcn(hadler) 这里pcn就是前面生成的代理对象类名
    4. 利用工具类ClassGenerator生成字节码并实例化对象返回

##### 通过**Proxy.getProxy(interfaces)**创建了代理类之后，再调用newInstance方法，通过InvokerInvocationHandler和Invoker创建了代理实例；

### getInvoker
```java
public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        final Wrapper wrapper = Wrapper.getWrapper(proxy.getClass().getName().indexOf('$') < 0 ? proxy.getClass() : type);
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                return wrapper.invokeMethod(proxy, methodName, parameterTypes, arguments);
            }
        };
    }
```

##### 实现过程如下：
1. 根据传入的 proxy对象的类信息创建对它的包装对象Wrapper,这里同样是通过javassist生成字节码创建的。详细的过程就不介绍了，和上面的过程很类似
2. 返回AbstractProxyInvoker对象实例，这个invoker对象invoke方法可以根据传入的invocation对象中包含的方法名，方法参数来调用wrapper对象返回调用结果

## StubProxyFactoryWrapper
```java
public class StubProxyFactoryWrapper implements ProxyFactory {

    private static final Logger LOGGER = LoggerFactory.getLogger(StubProxyFactoryWrapper.class);

    private final ProxyFactory proxyFactory;

    private Protocol protocol;

    public StubProxyFactoryWrapper(ProxyFactory proxyFactory) {
        this.proxyFactory = proxyFactory;
    }

    public void setProtocol(Protocol protocol) {
        this.protocol = protocol;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public <T> T getProxy(Invoker<T> invoker) throws RpcException {
        T proxy = proxyFactory.getProxy(invoker);
        if (GenericService.class != invoker.getInterface()) {
            String stub = invoker.getUrl().getParameter(Constants.STUB_KEY, invoker.getUrl().getParameter(Constants.LOCAL_KEY));
            if (ConfigUtils.isNotEmpty(stub)) {
                Class<?> serviceType = invoker.getInterface();
                if (ConfigUtils.isDefault(stub)) {
                    if (invoker.getUrl().hasParameter(Constants.STUB_KEY)) {
                        stub = serviceType.getName() + "Stub";
                    } else {
                        stub = serviceType.getName() + "Local";
                    }
                }
                try {
                    Class<?> stubClass = ReflectUtils.forName(stub);
                    if (!serviceType.isAssignableFrom(stubClass)) {
                        throw new IllegalStateException("The stub implementation class " + stubClass.getName() + " not implement interface " + serviceType.getName());
                    }
                    try {
                        Constructor<?> constructor = ReflectUtils.findConstructor(stubClass, serviceType);
                        proxy = (T) constructor.newInstance(new Object[]{proxy});
                        //export stub service
                        URL url = invoker.getUrl();
                        if (url.getParameter(Constants.STUB_EVENT_KEY, Constants.DEFAULT_STUB_EVENT)) {
                            url = url.addParameter(Constants.STUB_EVENT_METHODS_KEY, StringUtils.join(Wrapper.getWrapper(proxy.getClass()).getDeclaredMethodNames(), ","));
                            url = url.addParameter(Constants.IS_SERVER_KEY, Boolean.FALSE.toString());
                            try {
                                export(proxy, (Class) invoker.getInterface(), url);
                            } catch (Exception e) {
                                LOGGER.error("export a stub service error.", e);
                            }
                        }
                    } catch (NoSuchMethodException e) {
                        throw new IllegalStateException("No such constructor \"public " + stubClass.getSimpleName() + "(" + serviceType.getName() + ")\" in stub implementation class " + stubClass.getName(), e);
                    }
                } catch (Throwable t) {
                    LOGGER.error("Failed to create stub implementation class " + stub + " in consumer " + NetUtils.getLocalHost() + " use dubbo version " + Version.getVersion() + ", cause: " + t.getMessage(), t);
                    // ignore
                }
            }
        }
        return proxy;
    }

    public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) throws RpcException {
        return proxyFactory.getInvoker(proxy, type, url);
    }

    private <T> Exporter<T> export(T instance, Class<T> type, URL url) {
        return protocol.export(proxyFactory.getInvoker(instance, type, url));
    }

}
```
##### StubProxyFactoryWrapper实现了对代理工厂进行装饰的功能，主要用于暴露服务提供者的本地服务给远端消费者来调用

## 总结
##### jdk和javassist的实现的区别就在于是jdk提供的字节码功能还是通过javassist来自定义类。本质上来说原理是一样的。整个的流程就像前面提到的
1. 拿到**实际执行对象**，通过该对象去创建Invoker
2. 通过Invoker再去创建代理对象

##### 但是其中有一些问题需要去思考：
1. 这个代理的流程是从哪里发起的
2. 如果是消费端，只有服务的接口，没有实际执行的对象。那么这个代理是如何产生的；
3. 为什么javassist的getInvoker中，还需要实现wrapper类