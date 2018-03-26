---
layout: post
title: dubbo-负载均衡实现
date: 2018/03/23
tags: [tech, index, dubbo]
tag: [[java, java], [dubbo, dubbo]]
original: true
---

### 扩展说明
##### 从多个服务提者方中选择一个进行调用

### 扩展接口
##### `com.alibaba.dubbo.rpc.cluster.LoadBalance`

### 使用配置
```xml
<dubbo:provider loadbalance="" />
```
<!--more-->

### 目前已知扩展：
* random=com.alibaba.dubbo.rpc.cluster.loadbalance.RandomLoadBalance
* roundrobin=com.alibaba.dubbo.rpc.cluster.loadbalance.RoundRobinLoadBalance
* leastactive=com.alibaba.dubbo.rpc.cluster.loadbalance.LeastActiveLoadBalance
* consistenthash=com.alibaba.dubbo.rpc.cluster.loadbalance.ConsistentHashLoadBalance

### 包结构：
![](/img/note/dubbo/dubbo2.png)

### LoadBalance
```java
@SPI(RandomLoadBalance.NAME) //默认为random
public interface LoadBalance {

    /**
     * 从list当中选择一个invoker
     *
     * @param invokers   invokers.
     * @param url        refer url
     * @param invocation invocation.
     * @return selected invoker.
     */
    @Adaptive("loadbalance")
    <T> Invoker<T> select(List<Invoker<T>> invokers, URL url, Invocation invocation) throws RpcException;
}
```
##### 只有一个接口，很简单，提供invokers集合，返回其中一个

### AbstractLoadBalance
```java
public abstract class AbstractLoadBalance implements LoadBalance {

    static int calculateWarmupWeight(int uptime, int warmup, int weight) {
        int ww = (int) ((float) uptime / ((float) warmup / (float) weight));
        return ww < 1 ? 1 : (ww > weight ? weight : ww);
    }

    public <T> Invoker<T> select(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        if (invokers == null || invokers.isEmpty())
            return null;
        if (invokers.size() == 1)
            return invokers.get(0);
        return doSelect(invokers, url, invocation);
    }

    protected abstract <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation);

    protected int getWeight(Invoker<?> invoker, Invocation invocation) {
        int weight = invoker.getUrl().getMethodParameter(invocation.getMethodName(), Constants.WEIGHT_KEY, Constants.DEFAULT_WEIGHT);
        if (weight > 0) {
            long timestamp = invoker.getUrl().getParameter(Constants.REMOTE_TIMESTAMP_KEY, 0L);
            if (timestamp > 0L) {
                int uptime = (int) (System.currentTimeMillis() - timestamp);
                int warmup = invoker.getUrl().getParameter(Constants.WARMUP_KEY, Constants.DEFAULT_WARMUP);
                if (uptime > 0 && uptime < warmup) {
                    weight = calculateWarmupWeight(uptime, warmup, weight);
                }
            }
        }
        return weight;
    }

}
```

##### 抽象类**AbstractLoadBalance**实现了接口**LoadBalance**的select方法。主要是做了一些边界值的判断，正在的操作在抽象方法doSelect中。

##### **getWeight**方法将从Invoker的url中获取**weight**参数。默认为100

## random 随机
##### dubbo默认的负载方式，看下**doSelect**方法
```java
protected <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        int length = invokers.size(); // invokers数量
        int totalWeight = 0; // 总权重
        boolean sameWeight = true; // 是不是所有的权重都是一样的
        for (int i = 0; i < length; i++) {
            int weight = getWeight(invokers.get(i), invocation);
            totalWeight += weight; // 相加
            if (sameWeight && i > 0
                    && weight != getWeight(invokers.get(i - 1), invocation)) {
                sameWeight = false;
            }
        }
        if (totalWeight > 0 && !sameWeight) {
            //如果权重不是都相等，则用随机数生成
            int offset = random.nextInt(totalWeight);
            // 返回一个在包含该随机值的invoker
            for (int i = 0; i < length; i++) {
                offset -= getWeight(invokers.get(i), invocation);
                if (offset < 0) {
                    return invokers.get(i);
                }
            }
        }
        //如果权重都相等或者总和为0，则随机一个
        return invokers.get(random.nextInt(length));
    }
```
##### 可以看到，dubbo的随机负载均衡策略是包含了权重的概念的。所以也不是完全随机。


## roundrobin 轮询
```java
protected <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        //通过serviceKey和方法名构建key
        String key = invokers.get(0).getUrl().getServiceKey() + "." + invocation.getMethodName();
        int length = invokers.size(); // invokers数量
        int maxWeight = 0; // 最大的 权重 值
        int minWeight = Integer.MAX_VALUE; // 最小的 权重 值
        final LinkedHashMap<Invoker<T>, IntegerWrapper> invokerToWeightMap = new LinkedHashMap<Invoker<T>, IntegerWrapper>();//有序map
        int weightSum = 0; //权重 总值
        for (int i = 0; i < length; i++) {
            int weight = getWeight(invokers.get(i), invocation); //获取单个invoker的权重
            maxWeight = Math.max(maxWeight, weight); // 是不是最大的
            minWeight = Math.min(minWeight, weight); // 是不是最小的
            if (weight > 0) {
                invokerToWeightMap.put(invokers.get(i), new IntegerWrapper(weight));
                weightSum += weight;
            }
        }
        AtomicPositiveInteger sequence = sequences.get(key);
        if (sequence == null) {
            sequences.putIfAbsent(key, new AtomicPositiveInteger());
            sequence = sequences.get(key);
        }
        //记录该接口的调用次数
        int currentSequence = sequence.getAndIncrement();
        if (maxWeight > 0 && minWeight < maxWeight) {
            int mod = currentSequence % weightSum;
            for (int i = 0; i < maxWeight; i++) {
                for (Map.Entry<Invoker<T>, IntegerWrapper> each : invokerToWeightMap.entrySet()) {
                    final Invoker<T> k = each.getKey();
                    final IntegerWrapper v = each.getValue();
                    if (mod == 0 && v.getValue() > 0) {
                        return k;
                    }
                    if (v.getValue() > 0) {
                        v.decrement();
                        mod--;
                    }
                }
            }
        }
        // 如果权重都一样。或者都小于0。则按照调用次数轮询
        return invokers.get(currentSequence % length);
    }
```

##### 可以看到dubbo的轮询不是完全按照次数轮询的。而是按照公约后的权重设置轮询比率，即权重轮询算法(Weighted Round-Robin) ，它是基于轮询算法改进而来的。具体算法原理可以再网上搜索`权重轮询调度算法`或者见博客[dubbo-动态代理实现](http://localhost:4000/arithmetic/roundrobinWeight/)。

## leastactive 最小活跃数
```java
protected <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        int length = invokers.size(); // invokers数量
        int leastActive = -1; // 所有invokers中最小的活跃数
        int leastCount = 0; // invokers当中有多少个invoker的活跃数是leastActive
        int[] leastIndexs = new int[length]; // 这些活跃数等于leastActive的下标
        int totalWeight = 0; // 总权重
        int firstWeight = 0; // Initial value, used for comparision
        boolean sameWeight = true; // 所有的权重都相等？
        for (int i = 0; i < length; i++) {
            Invoker<T> invoker = invokers.get(i);
            int active = RpcStatus.getStatus(invoker.getUrl(), invocation.getMethodName()).getActive(); // 活跃数
            int weight = invoker.getUrl().getMethodParameter(invocation.getMethodName(), Constants.WEIGHT_KEY, Constants.DEFAULT_WEIGHT); // 权重
            if (leastActive == -1 || active < leastActive) { // 如果活跃数比之前的都小
                leastActive = active; // 记录最小活跃值
                leastCount = 1; // 重新计算数量
                leastIndexs[0] = i; // 重置
                totalWeight = weight; // 重置总权重
                firstWeight = weight; // 记录为firstWeight
                sameWeight = true; // 重置，所有的权重相等
            } else if (active == leastActive) { // 如果和之前的最小活跃值相等
                leastIndexs[leastCount++] = i; //记录下标
                totalWeight += weight; // 总权重相加
                // 在活跃值相等的情况下权重是不是相等
                if (sameWeight && i > 0
                        && weight != firstWeight) {
                    sameWeight = false;
                }
            }
        }
        // assert(leastCount > 0)
        if (leastCount == 1) {
            // 如果最小活跃值的Invoker只有一个，则直接返回
            return invokers.get(leastIndexs[0]);
        }
        if (!sameWeight && totalWeight > 0) {
            // 如果总权重值大于0并且各个Invoker的权重不相等，则随机取一个，可以看到这里的过程和random的过程是很像的
            int offsetWeight = random.nextInt(totalWeight);
            for (int i = 0; i < leastCount; i++) {
                int leastIndex = leastIndexs[i];
                offsetWeight -= getWeight(invokers.get(leastIndex), invocation);
                if (offsetWeight <= 0)
                    return invokers.get(leastIndex);
            }
        }
        // 如果所有Invoker的权重相等，或者总权重等于0.则随机选取一个
        return invokers.get(leastIndexs[random.nextInt(leastCount)]);
    }
```

##### 在**最小活跃数**的轮询算法中有一个很重要的概念就是活跃数，dubbo的活跃数是如何来的呢。
### 活跃数的变化
##### 活跃数的修改发生在com.alibaba.dubbo.rpc.filter.ActiveLimitFilter中。若未配置actives属性，则每进行一次调用前该invoker关联的活跃数加1，调用结束后活跃数减1。
##### beginCount对活跃数加1，endCount对活跃数减1。
```java
long begin = System.currentTimeMillis();
            RpcStatus.beginCount(url, methodName);
            try {
                Result result = invoker.invoke(invocation);
                RpcStatus.endCount(url, methodName, System.currentTimeMillis() - begin, true);
                return result;
            } catch (RuntimeException t) {
                RpcStatus.endCount(url, methodName, System.currentTimeMillis() - begin, false);
                throw t;
            }
```

##### 如果使用LeastActive负载均衡，则需要启用ActiveLimitFilter，这样活跃数才会变化。
##### 因此需要配置filter，filter 为 “activelimit”。
```xml
<dubbo:service interface="service.DemoService" ref = "demoService" loadbalance="leastactive" filter="activelimit"/>
```

##### 有了活跃数之后，dubbo所做的操作就是找到最小的活跃数的invokers。找到后再按照权重去随机。可以看到代码中的`totalWeight`指的是相同最小活跃数的权重总和。所以这个一个二维的算法，基于活跃数和权重。

## consistenthash 一致性hash
```java
protected <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        //按照ServiceKey和方法名拼成String key
        String key = invokers.get(0).getUrl().getServiceKey() + "." + invocation.getMethodName();
        //获取invokers的hashCode
        int identityHashCode = System.identityHashCode(invokers);
        //以调用方法名为key,获取一致性hash选择器
        ConsistentHashSelector<T> selector = (ConsistentHashSelector<T>) selectors.get(key);
        // 若不存在则创建新的选择器
        if (selector == null || selector.identityHashCode != identityHashCode) {
            selectors.put(key, new ConsistentHashSelector<T>(invokers, invocation.getMethodName(), identityHashCode));
            selector = (ConsistentHashSelector<T>) selectors.get(key);
        }
        // 选择结点
        return selector.select(invocation);
    }
```

##### 可以看到doSelect中的方法只是找到或者创建选择器，真正的选择过程在ConsistentHashSelector中
```java
private static final class ConsistentHashSelector<T> {

        private final TreeMap<Long, Invoker<T>> virtualInvokers; // 虚拟结点

        private final int                       replicaNumber;   // 副本数

        private final int                       identityHashCode;// hashCode

        private final int[]                     argumentIndex;   // 参数索引数组

        public ConsistentHashSelector(List<Invoker<T>> invokers, String methodName, int identityHashCode) {
            // 创建TreeMap 来保存结点
            this.virtualInvokers = new TreeMap<Long, Invoker<T>>();
            // 生成调用结点HashCode
            this.identityHashCode = System.identityHashCode(invokers);
            // 获取Url
            URL url = invokers.get(0).getUrl();
            // 获取所配置的结点数，如没有设置则使用默认值160
            this.replicaNumber = url.getMethodParameter(methodName, "hash.nodes", 160);
            // 获取需要进行hash的参数数组索引，默认对第一个参数进行hash
            String[] index = Constants.COMMA_SPLIT_PATTERN.split(url.getMethodParameter(methodName, "hash.arguments", "0"));
            argumentIndex = new int[index.length];
            for (int i = 0; i < index.length; i ++) {
                argumentIndex[i] = Integer.parseInt(index[i]);
            }
            // 创建虚拟结点
            // 对每个invoker生成replicaNumber个虚拟结点，并存放于TreeMap中
            for (Invoker<T> invoker : invokers) {

                for (int i = 0; i < replicaNumber / 4; i++) {
                    // 根据md5算法为每4个结点生成一个消息摘要，摘要长为16字节128位。
                    byte[] digest = md5(invoker.getUrl().toFullString() + i);
                    // 随后将128位分为4部分，0-31,32-63,64-95,95-128，并生成4个32位数，存于long中，long的高32位都为0
                    // 并作为虚拟结点的key。
                    for (int h = 0; h < 4; h++) {
                        long m = hash(digest, h);
                        virtualInvokers.put(m, invoker);
                    }
                }
            }
        }

        public int getIdentityHashCode() {
            return identityHashCode;
        }

        // 选择结点
        public Invoker<T> select(Invocation invocation) {
            // 根据调用参数来生成Key
            String key = toKey(invocation.getArguments());
            // 根据这个参数生成消息摘要
            byte[] digest = md5(key);
            //调用hash(digest, 0)，将消息摘要转换为hashCode，这里仅取0-31位来生成HashCode
            //调用sekectForKey方法选择结点。
            Invoker<T> invoker = sekectForKey(hash(digest, 0));
            return invoker;
        }

        private String toKey(Object[] args) {
            StringBuilder buf = new StringBuilder();
            // 由于hash.arguments没有进行配置，因为只取方法的第1个参数作为key
            for (int i : argumentIndex) {
                if (i >= 0 && i < args.length) {
                    buf.append(args[i]);
                }
            }
            return buf.toString();
        }

        //根据hashCode选择结点
        private Invoker<T> sekectForKey(long hash) {
            Invoker<T> invoker;
            Long key = hash;
            // 若HashCode直接与某个虚拟结点的key一样，则直接返回该结点
            if (!virtualInvokers.containsKey(key)) {
                // 若不一致，找到一个最小上届的key所对应的结点。
                SortedMap<Long, Invoker<T>> tailMap = virtualInvokers.tailMap(key);
                // 若存在则返回，例如hashCode落在图中[1]的位置
                // 若不存在，例如hashCode落在[2]的位置，那么选择treeMap中第一个结点
                // 使用TreeMap的firstKey方法，来选择最小上界。
                if (tailMap.isEmpty()) {
                    key = virtualInvokers.firstKey();
                } else {

                    key = tailMap.firstKey();
                }
            }
            invoker = virtualInvokers.get(key);
            return invoker;
        }

        private long hash(byte[] digest, int number) {
            return (((long) (digest[3 + number * 4] & 0xFF) << 24)
                    | ((long) (digest[2 + number * 4] & 0xFF) << 16)
                    | ((long) (digest[1 + number * 4] & 0xFF) << 8)
                    | (digest[0 + number * 4] & 0xFF))
                    & 0xFFFFFFFFL;
        }

        private byte[] md5(String value) {
            MessageDigest md5;
            try {
                md5 = MessageDigest.getInstance("MD5");
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalStateException(e.getMessage(), e);
            }
            md5.reset();
            byte[] bytes = null;
            try {
                bytes = value.getBytes("UTF-8");
            } catch (UnsupportedEncodingException e) {
                throw new IllegalStateException(e.getMessage(), e);
            }
            md5.update(bytes);
            return md5.digest();
        }

    }
```

##### 在进行选择时候若HashCode直接与某个虚拟结点的key一样，则直接返回该结点，例如hashCode落在某个结点上(圆圈所表示)。若不在，找到一个最小上届的key所对应的结点。例如进行选择时的key落在图中1所标注的位置。由于利用TreeMap存储，key所落在的位置可能无法找到最小上界，例如图中2所标注的位置。那么需要返回TreeMap中的最小值（构成逻辑环状结构，找不到，则返回最开头的结点）。
![](/img/note/dubbo/dubbo3.png)

##### 以上为dubbo的一致性hash算法实现，其中涉及到两个主要的配置参数为hash.arguments 与hash.nodes。
##### **hash.arguments**： 当进行调用时候根据调用方法的哪几个参数生成key，并根据key来通过一致性hash算法来选择调用结点。例如调用方法invoke(String s1,String s2); 若hash.arguments为1(默认值)，则仅取invoke的参数1（s1）来生成hashCode。

##### **hash.nodes**： 为结点的副本数。
```xml
缺省只对第一个参数Hash，如果要修改，请配置
<dubbo:parameter key="hash.arguments" value="0,1" />

缺省用160份虚拟节点，如果要修改，请配置
<dubbo:parameter key="hash.nodes" value="320" />
```