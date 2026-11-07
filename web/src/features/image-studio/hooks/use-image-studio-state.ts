import { useCallback, useEffect, useRef, useState } from "react";

import { getUserGroups, getUserModels } from "../api";
import { DEFAULT_GROUP, DEFAULT_IMAGE_MODEL } from "../constants";
import {
  createDefaultParametersForModel,
  isSupportedImageModel,
  normalizeConfigForModel,
  resolveImageModelAdapter,
} from "../lib/model-params";
import type {
  GptImageConfig,
  GptImageConfigUpdater,
} from "../lib/model-params/gpt-image/types";
import type {
  SeedreamConfig,
  SeedreamConfigUpdater,
} from "../lib/model-params/seedream/types";
import type {
  GroupOption,
  ImageStudioConfig,
  ImageStudioParameters,
  ModelOption,
} from "../types";

export function isLikelyImageModel(model: string): boolean {
  return isSupportedImageModel(model);
}

export function useImageStudioState() {
  const defaultParameters =
    createDefaultParametersForModel(DEFAULT_IMAGE_MODEL);
  if (!defaultParameters) {
    throw new Error(`Unsupported default image model: ${DEFAULT_IMAGE_MODEL}`);
  }

  const [config, setConfig] = useState<ImageStudioConfig>(() => ({
    group: DEFAULT_GROUP,
    model: DEFAULT_IMAGE_MODEL,
    parameters: { ...defaultParameters },
  }));
  const parameterCacheRef = useRef<
    Partial<Record<"gpt-image" | "seedream", ImageStudioParameters>>
  >({
    "gpt-image": { ...defaultParameters },
  });
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const updateGroup = useCallback((group: string) => {
    setConfig((previousConfig) => ({ ...previousConfig, group }));
  }, []);

  const updateModel = useCallback((model: string) => {
    setConfig((previousConfig) => {
      const nextAdapter = resolveImageModelAdapter(model);
      if (!nextAdapter) return previousConfig;
      parameterCacheRef.current[previousConfig.parameters.family] =
        previousConfig.parameters;
      const cachedParameters = parameterCacheRef.current[nextAdapter.family];
      const parameters =
        cachedParameters?.family === nextAdapter.family
          ? cachedParameters
          : createDefaultParametersForModel(model);
      if (!parameters) return previousConfig;
      return (
        normalizeConfigForModel({
          ...previousConfig,
          model,
          parameters: { ...parameters },
        }) ?? previousConfig
      );
    });
  }, []);

  const updateParameters = useCallback((parameters: ImageStudioParameters) => {
    setConfig((previousConfig) => {
      const adapter = resolveImageModelAdapter(previousConfig.model);
      if (!adapter || adapter.family !== parameters.family) {
        return previousConfig;
      }
      const nextConfig = normalizeConfigForModel({
        ...previousConfig,
        parameters,
      });
      if (!nextConfig) return previousConfig;
      parameterCacheRef.current[parameters.family] = nextConfig.parameters;
      return nextConfig;
    });
  }, []);

  const updateGptImageConfig = useCallback<GptImageConfigUpdater>(
    (key, value) => {
      setConfig((previousConfig) => {
        if (previousConfig.parameters.family !== "gpt-image") {
          return previousConfig;
        }
        const parameters: GptImageConfig = {
          ...previousConfig.parameters,
          [key]: value,
        };
        const nextConfig = normalizeConfigForModel({
          ...previousConfig,
          parameters,
        });
        if (!nextConfig) return previousConfig;
        parameterCacheRef.current["gpt-image"] = nextConfig.parameters;
        return nextConfig;
      });
    },
    [],
  );

  const updateSeedreamConfig = useCallback<SeedreamConfigUpdater>(
    (key, value) => {
      setConfig((previousConfig) => {
        if (previousConfig.parameters.family !== "seedream") {
          return previousConfig;
        }
        const parameters: SeedreamConfig = {
          ...previousConfig.parameters,
          [key]: value,
        };
        parameterCacheRef.current.seedream = parameters;
        return { ...previousConfig, parameters };
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void getUserGroups()
      .then((loadedGroups) => {
        if (cancelled || loadedGroups.length === 0) return;
        setGroups(loadedGroups);
        setConfig((previousConfig) => {
          if (
            loadedGroups.some((group) => group.value === previousConfig.group)
          ) {
            return previousConfig;
          }
          return { ...previousConfig, group: loadedGroups[0].value };
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingModels(true);
    void getUserModels(config.group)
      .then((loadedModels) => {
        if (cancelled) return;
        const supportedModels = loadedModels.filter((model) =>
          isSupportedImageModel(model.value),
        );
        setModels(supportedModels);
        setConfig((previousConfig) => {
          if (
            previousConfig.model &&
            supportedModels.some(
              (model) => model.value === previousConfig.model,
            )
          ) {
            return previousConfig;
          }
          const defaultModel = supportedModels.find(
            (model) => model.value === DEFAULT_IMAGE_MODEL,
          );
          const nextModel = defaultModel ?? supportedModels[0];
          if (!nextModel) return { ...previousConfig, model: "" };
          const adapter = resolveImageModelAdapter(nextModel.value);
          if (!adapter) return { ...previousConfig, model: "" };
          const cachedParameters = parameterCacheRef.current[adapter.family];
          const parameters =
            cachedParameters?.family === adapter.family
              ? cachedParameters
              : createDefaultParametersForModel(nextModel.value);
          if (!parameters) return { ...previousConfig, model: "" };
          return (
            normalizeConfigForModel({
              ...previousConfig,
              model: nextModel.value,
              parameters: { ...parameters },
            }) ?? previousConfig
          );
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config.group]);

  return {
    config,
    updateGroup,
    updateModel,
    updateParameters,
    updateGptImageConfig,
    updateSeedreamConfig,
    groups,
    models,
    isLoadingModels,
  };
}
