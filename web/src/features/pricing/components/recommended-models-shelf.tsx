import AutoScroll from "embla-carousel-auto-scroll";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useMediaQuery } from "@/hooks/use-media-query";

import { DEFAULT_TOKEN_UNIT } from "../constants";
import { useModelPerfBadges } from "../hooks/use-model-perf-badges";
import type { PricingModel, TokenUnit } from "../types";
import { ModelCard } from "./model-card";
import { ModelRecommendationBadge } from "./model-recommendation-badge";

/** Pixels per frame the shelf drifts; slow enough to read a card while it moves. */
const SHELF_SCROLL_SPEED = 2;
/**
 * Milliseconds AutoScroll waits before drifting again. The plugin reuses one
 * timer for the first start and for every resume, so the 1000ms default makes
 * the shelf look stuck after the pointer leaves.
 */
const SHELF_SCROLL_START_DELAY = 0;

export interface RecommendedModelsShelfProps {
  models: PricingModel[];
  onModelClick: (modelName: string) => void;
  priceRate?: number;
  usdExchangeRate?: number;
  tokenUnit?: TokenUnit;
  showRechargePrice?: boolean;
  selectedGroup?: string;
  currentUserGroup?: string;
  maskPrices?: boolean;
}

/**
 * Curated recommendations pinned above the catalog so every recommended model
 * stays reachable without scrolling or clearing the active filters. The shelf
 * drifts forward on its own and loops, pausing on hover and keyboard focus.
 */
export function RecommendedModelsShelf(props: RecommendedModelsShelfProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const shelfRef = useRef<HTMLDivElement>(null);
  const perfMap = useModelPerfBadges();
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const [api, setApi] = useState<CarouselApi>();
  const [isScrollable, setIsScrollable] = useState(false);
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT;
  const recommendedModels = useMemo(
    () => props.models.filter((model) => model.is_recommended),
    [props.models],
  );
  const plugins = useMemo(
    () =>
      prefersReducedMotion
        ? []
        : [
            AutoScroll({
              speed: SHELF_SCROLL_SPEED,
              startDelay: SHELF_SCROLL_START_DELAY,
              stopOnMouseEnter: true,
              stopOnInteraction: false,
              // Drift pauses across the whole shelf, including the header and
              // its arrows: the arrows only drive the carousel while it is
              // paused, otherwise auto scroll overrides their target.
              rootNode: () => shelfRef.current,
            }),
          ],
    [prefersReducedMotion],
  );

  useEffect(() => {
    if (!api) return;
    const measure = () =>
      setIsScrollable(
        api.containerNode().scrollWidth > api.rootNode().clientWidth,
      );
    measure();
    api.on("reInit", measure).on("resize", measure);
    return () => {
      api.off("reInit", measure).off("resize", measure);
    };
  }, [api]);

  if (recommendedModels.length === 0) return null;

  return (
    <Carousel
      ref={shelfRef}
      setApi={setApi}
      aria-labelledby={headingId}
      opts={{ align: "start", dragFree: true, loop: true }}
      plugins={plugins}
      className="min-w-0"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center">
          <ModelRecommendationBadge
            prominent
            label={t("Recommended models")}
          />
        </h2>
        {isScrollable && (
          <div className="flex shrink-0 items-center gap-1.5">
            <CarouselPrevious className="static top-auto left-auto translate-y-0" />
            <CarouselNext className="static top-auto right-auto translate-y-0" />
          </div>
        )}
      </div>
      <CarouselContent className="pt-4 pb-1">
        {recommendedModels.map((model) => (
          <CarouselItem
            key={model.id ?? model.model_name}
            className="basis-[88%] pl-4 sm:basis-[380px]"
          >
            <ModelCard
              model={model}
              showRecommendationBadge={false}
              tokenUnit={tokenUnit}
              priceRate={props.priceRate}
              usdExchangeRate={props.usdExchangeRate}
              showRechargePrice={props.showRechargePrice}
              selectedGroup={props.selectedGroup}
              currentUserGroup={props.currentUserGroup}
              maskPrices={props.maskPrices}
              perf={perfMap.get(model.model_name || "")}
              onClick={() => props.onModelClick(model.model_name || "")}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
