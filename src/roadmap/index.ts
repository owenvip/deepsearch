import { BaseMessage, HumanMessage, isAIMessage, ToolMessage } from '@langchain/core/messages'
import { tool } from '@langchain/core/tools';
import { Annotation, Command, END, messagesStateReducer, START, StateGraph } from '@langchain/langgraph'
import { createReactAgent } from 'langchain/agents';
import z from 'zod';
import { getBaseChatModel } from '../utils';
import { ToolNode } from '@langchain/langgraph/prebuilt';

async function getDistance(location: string) {
  const DistanceStateAnnotation = Annotation.Root({
    message: Annotation<BaseMessage[]>({
      default: () => [
        new HumanMessage({
          content: `请告诉我${location}的路程`,
        })
      ],
      reducer: messagesStateReducer,
    }
    ),
  })

  const innerTool = tool(
    async (_input, config) => {
      const resp = await fetch(`https://restapi.amap.com/v3/distance?origins=106.488794,29.636012&destination=106.488794,29.636012&key=${process.env.AMAP_KEY}`)
      const respJson = await resp.json()
      const result = respJson.results[0]
      /**
     * 由Agent 调用的并行任务，返回值需由 Command 完成，不能直接返字符串，否则会报错
     */
      return new Command({
        update: {
          message: [
            new ToolMessage({
              content: `当前位置到目的地共${result.distance}米`,
              tool_call_id: config.toolCall.id
            })
          ]
        }
      })
    },
    {  // 告诉大模型 这个tools 是干嘛的，需要那些参数
      name: "getDistance",
      description: "获取路程信息",
      schema: z.object({
        location: z.string().describe('需要获取路程的位置'),
      }),
    }
  )

  const tools = [innerTool]

  const modelWithTools = getBaseChatModel().bindTools(tools)

  // 工具的集合
  const toolNodeForGraph = new ToolNode(tools)
  const shouldContinue = (state: typeof DistanceStateAnnotation.State) => {
    const lastMessage = state.message[state.message.length - 1]
    if (isAIMessage(lastMessage) && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
      console.log("===Distance===lastMessage===== END");
      return END;
    } else {
      return "continue";
    }
  }

  const callModel = async (state: typeof DistanceStateAnnotation.State) => {
    const message = await modelWithTools.invoke(state.message);
    return { message };
  }

  return {
    toolNodeForGraph,
    shouldContinue,
    callModel,
    DistanceStateAnnotation
  }
}
async function getWeather(location: string) {
  const WeatherStateAnnotation = Annotation.Root({
    message: Annotation<BaseMessage[]>({
      default: () => [
        new HumanMessage({
          content: `请告诉我${location}的天气情况`,
        })
      ],
      reducer: messagesStateReducer
    }
    ),
  })

  const innerTool = tool(
    async (_input, config) => {
      const resp = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?city=500112&key=${process.env.AMAP_KEY}`)
      const respJson = await resp.json()
      const result = respJson.lives[0]
      /**
     * 由Agent 调用的并行任务，返回值需由 Command 完成，不能直接返字符串，否则会报错
     */
      return new Command({
        update: {
          message: [
            new ToolMessage({
              content: `${result.city}${result.weather}，温度${result.temperature}度`,
              tool_call_id: config.toolCall.id
            })
          ]
        }
      })
    },
    {  // 告诉大模型 这个tools 是干嘛的，需要那些参数
      name: "getWeather",
      description: "获取天气信息",
      schema: z.object({
        location: z.string().describe('需要获取天气的位置'),
      }),
    }
  )

  const tools = [innerTool]

  const modelWithTools = getBaseChatModel().bindTools(tools)

  // 工具的集合
  const toolNodeForGraph = new ToolNode(tools)
  const shouldContinue = (state: typeof WeatherStateAnnotation.State) => {
    const lastMessage = state.message[state.message.length - 1]
    if (isAIMessage(lastMessage) && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
      console.log("===weather===lastMessage===== END");
      return END;
    } else {
      return "continue";
    }
  }

  const callModel = async (state: typeof WeatherStateAnnotation.State) => {
    const message = await modelWithTools.invoke(state.message);
    return { message };
  }

  return {
    toolNodeForGraph,
    shouldContinue,
    callModel,
    WeatherStateAnnotation
  }
}

async function main() {
  const location = '重庆磁器口'

  const weather = await getWeather(location)
  const distance = await getDistance(location)

  const stateAnnotation = Annotation.Root({
    location: Annotation<string>(),
    ...weather.WeatherStateAnnotation.spec,
    ...distance.DistanceStateAnnotation.spec,
    result: Annotation<string>()
  })

  const workflow = new StateGraph(stateAnnotation)
  workflow.addNode('weather_agent', weather.callModel)
  /**
   * 注意事项！！！
   * 如果N个ToolNode并行调用，则不能直接使用 callModel 自动调用 tools 的形式
   *   workflow.addNode("weather_tools", weather.toolNodeForGraph);
   * 原因是 ToolNode 源s码默认消费的是 state 中的 messages 字段，而实际上是没有这个字段的（因为不同的agent使用不同的message字段存储）
   * 所以需要读取上下文数据后 自定义调用 invoke 方法，并解析出内部的数据
   */
  workflow.addNode("weather_tools", async (state) => {
    const data: Command[] = await weather.toolNodeForGraph.invoke(state.message);
    const merges = data?.map(ele => ele.update?.message) || [];
    const weatherMessages: string[] = [];
    merges.forEach(ele => {
      if (Array.isArray(ele)) {
        weatherMessages.push(...ele);
      }
    });
    return {
      weatherMessages
    };
  })

  workflow.addNode('distance_agent', weather.callModel)
  workflow.addNode("distance_tools", async (state) => {
    const data: Command[] = await weather.toolNodeForGraph.invoke(state.message);
    const merges = data?.map(ele => ele.update?.message) || [];
    const distanceMessages: string[] = [];
    merges.forEach(ele => {
      if (Array.isArray(ele)) {
        distanceMessages.push(...ele);
      }
    });
    return {
      distanceMessages
    };
  })

  workflow.addNode("messgae_wrapper", state => {
    return {
      result:
        state.weatherMessages[state.weatherMessages.length - 1].content +
        "\n" +
        state.distanceMessages[state.distanceMessages.length - 1].content
    };
  });

  workflow.addEdge(START, "weather_agent");
  workflow.addEdge(START, "distance_agent");

  workflow.addEdge("weather_tools", "weather_agent");

  workflow.addConditionalEdges("weather_agent", weather.shouldContinue, {
    continue: "weather_tools",
    [END]: "messgae_wrapper"
  });

  workflow.addEdge("distance_tools", "distance_agent");
  workflow.addConditionalEdges("distance_agent", distance.shouldContinue, {
    continue: "distance_tools",
    [END]: "messgae_wrapper"
  });

  workflow.addEdge("messgae_wrapper", END);

  const graph = await workflow.compile();
  const graphStructure = await graph.getGraphAsync();
  const graphImg = graphStructure?.drawMermaid();
  console.log("=======merchantid=====start==");
  console.log(graphImg);
  console.log("=======merchantid=====end==");

  const stream = await graph.stream(
    {
      location
    },
    {
      streamMode: "values"
    }
  );

  let res = "";

  for await (const state of stream) {
    res = state.result;
  }
  console.log("=======result=========");
  console.log(res);
}

main()